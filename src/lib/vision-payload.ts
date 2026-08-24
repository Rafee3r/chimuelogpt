/* ─────────── Visión nativa de DeepSeek ───────────
   Antes cada imagen costaba DOS llamadas encadenadas: Claude Haiku la
   describía en texto y después DeepSeek redactaba a partir de esa
   descripción. Eso significaba el doble de latencia (peligroso con el
   límite de 60s de Vercel), el doble de puntos de fallo, y pérdida de
   detalle: el segundo modelo nunca veía la imagen, solo un resumen.

   Con visión nativa el modelo mira la foto y responde en una sola
   llamada. Claude queda como respaldo si el modelo de visión falla.

   Límites oficiales relevantes: 32 MiB por imagen, 600 imágenes por
   petición, y solo se aceptan imágenes en mensajes `user`.
*/

/** Único modelo con visión hoy; el resto devuelve 400. */
export const VISION_MODEL = 'deepseek-v4-flash-vision-exp';

/** 32 MiB por imagen (límite de la API). */
export const MAX_IMAGE_BYTES = 32 * 1024 * 1024;

/** La app permite 10 adjuntos; la API acepta hasta 600. */
export const MAX_IMAGES_PER_REQUEST = 600;

export const SUPPORTED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export type VisionMessage =
  | { role: 'system' | 'assistant'; content: string }
  | { role: 'user'; content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> };

/** Tamaño aproximado en bytes de un data URI base64 (4 chars ≈ 3 bytes). */
export function base64ByteSize(dataUri: string): number {
  const b64 = dataUri.includes('base64,') ? dataUri.split('base64,')[1] : dataUri;
  if (!b64) return 0;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

/** Descarta lo que la API rechazaría, para no gastar un viaje en un 400 seguro. */
export function filterUsableImages(images: string[]): { usable: string[]; skipped: number } {
  const usable: string[] = [];
  let skipped = 0;

  for (const img of images) {
    if (!img || typeof img !== 'string') { skipped++; continue; }
    const mime = img.match(/^data:([^;]+);base64,/)?.[1];
    const isRemote = /^https?:\/\//i.test(img);

    if (!isRemote && (!mime || !SUPPORTED_MIME.includes(mime))) { skipped++; continue; }
    if (!isRemote && base64ByteSize(img) > MAX_IMAGE_BYTES) { skipped++; continue; }
    if (usable.length >= MAX_IMAGES_PER_REQUEST) { skipped++; continue; }

    usable.push(img);
  }
  return { usable, skipped };
}

/**
 * Arma los mensajes para el endpoint de visión.
 * Las imágenes se adjuntan SOLO al último turno del usuario: en mensajes
 * system o assistant la API responde error.
 */
export function buildVisionMessages(
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userText: string,
  images: string[]
): VisionMessage[] {
  const { usable } = filterUsableImages(images);

  const priorTurns: VisionMessage[] = history
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
    { type: 'text', text: userText || 'Describe esta imagen.' },
    ...usable.map(url => ({ type: 'image_url' as const, image_url: { url } })),
  ];

  return [
    { role: 'system', content: systemPrompt },
    ...priorTurns,
    { role: 'user', content },
  ];
}
