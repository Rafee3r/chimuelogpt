/* ─────────── Parsers de marcadores en mensajes ───────────
   Regexes centralizadas para los tags/marcadores que la IA emite en su
   respuesta y que el cliente interpreta. page.tsx aún usa regex inline
   en varios puntos (migración gradual); las funciones nuevas consumen
   estas versiones canónicas y con tests. */

/* <think>...</think> — razonamiento del modelo (se oculta del render) */
export const THINK_RE = /<think>[\s\S]*?<\/think>/g;

export function stripThinkTags(content: string): string {
  return content.replace(THINK_RE, '').trim();
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
