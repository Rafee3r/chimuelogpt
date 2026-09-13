/* ─────────── Parsers de marcadores en mensajes ───────────
   Regexes centralizadas para los tags/marcadores que la IA emite en su
   respuesta y que el cliente interpreta. page.tsx aún usa regex inline
   en varios puntos (migración gradual); las funciones nuevas consumen
   estas versiones canónicas y con tests. */

/* <think>...</think> — razonamiento del modelo (se oculta del render) */
export const THINK_RE = /<think>[\s\S]*?<\/think>/g;

/* Variante tolerante: también captura un <think> que quedó SIN cerrar
   (stream cortado). Sin ella, un think abierto se mostraría crudo. */
export const THINK_OPEN_RE = /<think>[\s\S]*?(?:<\/think>|$)/g;

export function stripThinkTags(content: string): string {
  return content.replace(THINK_RE, '').trim();
}

/* ─────────── Resolución defensiva del contenido a mostrar ───────────
   Garantiza que una respuesta del asistente NUNCA se renderice como
   burbuja fantasma (avatar + botones, sin texto).

   Orden de intentos:
   1. Limpieza normal (think cerrado + bloques de contexto inyectado).
   2. Si quedó vacío: reintenta tolerando <think> sin cerrar.
   3. Si sigue vacío: usa el razonamiento como contenido (mejor mostrar
      el pensamiento que una burbuja muda).
   4. Si sigue vacío: reporta isEmpty para que la UI ofrezca reintentar.
*/
export function resolveDisplayContent(raw: string | null | undefined): {
  content: string;
  isEmpty: boolean;
} {
  const original = (raw || '').trim();
  if (!original) return { content: '', isEmpty: true };

  const stripContextBlocks = (s: string) =>
    s
      .replace(/\[DOCUMENTO ADJUNTO: [^\]]+\][\s\S]*?\[FIN DEL DOCUMENTO\]\n*/gi, '')
      .replace(/\[CONTENIDO ENLACE: [^\]]+\][\s\S]*?\[FIN ENLACE\]\n*/gi, '')
      .trim();

  // 1. Limpieza. THINK_OPEN_RE es lazy: si el tag cierra, para en </think>
  //    y conserva la respuesta; si quedó abierto, se lleva la cola huérfana.
  const content = stripContextBlocks(original.replace(THINK_OPEN_RE, ''));
  if (content) return { content, isEmpty: false };

  // 2. No hubo respuesta final: rescatar el razonamiento antes que mostrar nada
  const reasoning = original.match(/<think>([\s\S]*?)(?:<\/think>|$)/)?.[1]?.trim();
  if (reasoning) return { content: reasoning, isEmpty: false };

  // 3. Genuinamente vacío
  return { content: '', isEmpty: true };
}

/* __MUSIC_PLAYER:url::promptCodificado__ — canción generada.
   Lazy matching para permitir ':' dentro de la URL (https://...). */
export const MUSIC_MARKER_RE = /__MUSIC_PLAYER:(https?:\/\/.+?)::(.*?)__/;

export function parseMusicMarker(content: string): { url: string; prompt?: string } | null {
  const match = content.match(MUSIC_MARKER_RE);
  if (!match) return null;
  let prompt: string | undefined;
  try {
    prompt = match[2] ? decodeURIComponent(match[2]) : undefined;
  } catch {
    prompt = match[2] || undefined;
  }
  return { url: match[1], prompt };
}

/* <sticker>EMOJI</sticker> — sticker de agente estilo WhatsApp */
export const STICKER_RE = /<sticker>([^<]+)<\/sticker>/;

export function parseSticker(content: string): { emoji: string; rest: string } | null {
  const match = content.match(STICKER_RE);
  if (!match) return null;
  return {
    emoji: match[1].trim(),
    rest: content.replace(/<sticker>[^<]*<\/sticker>/, '').trim(),
  };
}

/* ![alt](url) — imágenes generadas insertadas como markdown */
export const IMAGE_MD_RE = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;

export function extractImageUrls(content: string): string[] {
  const urls: string[] = [];
  for (const match of content.matchAll(IMAGE_MD_RE)) {
    urls.push(match[1]);
  }
  return urls;
}

/* <set_reminder date="ISO" repeat="daily|weekly">texto</set_reminder>
   — recordatorio creado por un agente (Fase 3 del plan). */
export const SET_REMINDER_RE = /<set_reminder([^>]*)>([\s\S]*?)(?:<\/set_reminder>|$)/i;

export function parseSetReminderTag(content: string): {
  text: string;
  dueAt: number | null;
  repeat?: 'daily' | 'weekly';
  rest: string;
} | null {
  const match = content.match(SET_REMINDER_RE);
  if (!match) return null;
  const attrs = match[1] || '';
  const text = (match[2] || '').trim();
  if (!text) return null;

  const dateMatch = attrs.match(/date\s*=\s*["']([^"']+)["']/i);
  let dueAt: number | null = null;
  if (dateMatch) {
    // Solo aceptar formato ISO-like (YYYY-MM-DD[THH:mm...]) — Date.parse
    // de V8 es demasiado laxo y "entiende" strings basura como fechas.
    const isoLike = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/.test(dateMatch[1].trim());
    if (isoLike) {
      const parsed = Date.parse(dateMatch[1].trim());
      if (!Number.isNaN(parsed)) dueAt = parsed;
    }
  }

  const repeatMatch = attrs.match(/repeat\s*=\s*["'](daily|weekly)["']/i);
  const repeat = repeatMatch ? (repeatMatch[1].toLowerCase() as 'daily' | 'weekly') : undefined;

  return {
    text,
    dueAt,
    repeat,
    rest: content.replace(SET_REMINDER_RE, '').trim(),
  };
}

/* ─────────── Generación de imagen / PDF / archivo ───────────
   V4.1 Flash piensa por defecto y a veces deja las etiquetas XML
   dentro de <think> o en un fence markdown. El cliente las saca
   de ahí; si el modelo no las emite, page.tsx hace un fallback. */

export const TOOL_TAG_RE =
  /<(generate_image|generate_music|artifact|search_web|calc)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi;

function toolTagRe(): RegExp {
  return new RegExp(TOOL_TAG_RE.source, 'gi');
}

const VISUAL_NOUN =
  /(?:imagen(?:es)?|foto(?:s)?|dibujo(?:s)?|ilustraci[oó]n(?:es)?|pintura(?:s)?|render(?:s)?|wallpaper(?:s)?|banner(?:s)?|p[oó]ster(?:es)?|poster(?:s)?|sticker(?:s)?|meme(?:s)?|logo(?:s)?|retrato(?:s)?|escena(?:s)?|portada(?:s)?)/i;

const MAKE_VISUAL =
  /(?:genera|crea|hazme|h[aá]zme|h[aá]z\b|hacer|dibuja|pinta|dise[nñ]a|quiero|necesito|puedes|podr[ií]as|me haces|me hagas|m[aá]ndame|s[aá]came|mu[eé]strame|arma|dame)\w*/i;

const COLOR_OR_STYLE =
  /(?:verde|rojo|azul|negro|blanco|amarillo|rosa|naranja|morado|gris|dorado|plateado|celeste|caf[eé]|beige|ne[oó]n|anime|pixel|3d|realista|oscuro|claro|cyberpunk|acuarela|[oó]leo)/i;

export function userWantsImage(text: string): boolean {
  const t = text || '';
  if (!t.trim() || userWantsVideo(t)) return false;
  if (/\b(?:qu[eé] es|c[oó]mo (?:saco|hago|tomo|funciona|se (?:saca|hace|toma)))\b/i.test(t) && VISUAL_NOUN.test(t)) {
    return false;
  }
  if (VISUAL_NOUN.test(t) && MAKE_VISUAL.test(t)) return true;
  if (/(?:una|un)\s+(?:imagen|foto|dibujo|ilustraci[oó]n|logo|p[oó]ster|poster|wallpaper|banner)\s+de\b/i.test(t)) {
    return true;
  }
  if (/\b(?:dib[uú]jame|dib[uú]ja(?:me)?|p[ií]ntame|pinta(?:me)?|il[uú]strame)\b/i.test(t)) return true;
  if (
    /(?:h[aá]zmelo|h[aá]zmela|me hagas esto|me lo hagas|esto pero|esto en |quiero q(?:ue)? me hagas esto|p[oó]nlo(?: en)?|c[aá]mbialo|p[aá]salo a )/i.test(t)
    && COLOR_OR_STYLE.test(t)
  ) {
    return true;
  }
  return false;
}

export function userWantsVideo(text: string): boolean {
  const t = text || '';
  return /(?:genera|crea|hazme|haz |arma|anima|graba|render)\w*.{0,50}(?:v[ií]deo|clip|reel|tiktok|short|pel[ií]cula|animaci[oó]n)|(?:v[ií]deo|clip|reel|animaci[oó]n) de\b/i.test(t);
}

export function userWantsDocument(text: string): boolean {
  const t = text || '';
  return /(?:genera|crea|hazme|haz |arma|redacta|exporta|descarga)\w*.{0,50}(?:pdf|documento|ensayo|informe|invitaci[oó]n|plantilla|archivo)|(?:pdf|documento) (?:de|con|para)\b/i.test(t);
}

export function userWantsGeneratedMedia(text: string): boolean {
  const t = text || '';
  return userWantsImage(t) || userWantsDocument(t) || userWantsVideo(t)
    || /(?:genera|crea|comp[oó]n|hazme)\w*.{0,40}(?:canci[oó]n|m[uú]sica)/i.test(t);
}

export function unwrapFencedToolTags(content: string): string {
  return content
    .replace(
      /```(?:xml|html|text)?\s*(<(?:generate_image|generate_music|artifact|search_web|calc)[\s\S]*?<\/(?:generate_image|generate_music|artifact|search_web|calc)>)\s*```/gi,
      '$1',
    )
    .replace(
      /&lt;(\/??(?:generate_image|generate_music|artifact|artifact_title|artifact_desc|artifact_html|search_web|calc)[^&]*)&gt;/gi,
      '<$1>',
    );
}

export function liftToolTagsFromThink(fullText: string): string {
  const unwrapped = unwrapFencedToolTags(fullText || '');
  const thinkMatch = unwrapped.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
  if (!thinkMatch) return unwrapped;
  const tags = thinkMatch[1].match(toolTagRe()) || [];
  if (tags.length === 0) return unwrapped;
  const afterThink = unwrapped.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '');
  const missing = tags.filter(tag => !afterThink.includes(tag.slice(0, Math.min(48, tag.length))));
  if (missing.length === 0) return unwrapped;
  const thinkBody = thinkMatch[1].replace(toolTagRe(), '').trim();
  const lifted = missing.join('\n');
  if (/<\/think>/i.test(unwrapped)) {
    return unwrapped.replace(/<think>[\s\S]*?<\/think>/i, `<think>${thinkBody}</think>\n${lifted}\n`);
  }
  return `<think>${thinkBody}</think>\n${lifted}\n${afterThink}`;
}

export function wrapTextAsArtifact(title: string, body: string): string {
  const safeTitle = (title || 'Documento').replace(/</g, '').slice(0, 80);
  const escaped = (body || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
  return `<artifact>
  <artifact_title>${safeTitle}</artifact_title>
  <artifact_desc>Haz clic para ver y descargar</artifact_desc>
  <artifact_html>
    <html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:32px;max-width:720px;margin:auto;color:#111;line-height:1.55;background:#fff">
      <h1 style="letter-spacing:-0.03em;font-size:1.6rem">${safeTitle}</h1>
      <div style="font-size:1rem">${escaped}</div>
    </body></html>
  </artifact_html>
</artifact>`;
}
