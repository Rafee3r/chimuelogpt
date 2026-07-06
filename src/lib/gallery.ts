/* ─────────── Galería de creaciones ───────────
   Lógica pura (sin React) que extrae todas las imágenes y canciones
   generadas por la IA desde el array de chats.

   Formatos que produce la app hoy (ver page.tsx):
   - Imagen:  el contenido del mensaje assistant incluye `![Imagen Generada](url)`
   - Música:  el contenido incluye el marcador `__MUSIC_PLAYER:url::promptCodificado__`
*/

/* Tipos estructurales mínimos — evitan acoplarse a page.tsx (que no exporta tipos) */
export type GalleryChatMessage = {
  id: string;
  role: string;
  content?: string;
  timestamp?: number;
};

export type GalleryChat = {
  id: string;
  title?: string;
  updatedAt?: number;
  messages?: GalleryChatMessage[];
};

export type GalleryItem = {
  kind: 'image' | 'music';
  url: string;
  /* Prompt de la canción (decodificado) — solo para música */
  prompt?: string;
  chatId: string;
  chatTitle: string;
  messageId: string;
  /* timestamp del mensaje, o updatedAt del chat como fallback */
  timestamp: number;
};

/* Imágenes generadas: markdown estándar con URL http(s).
   Cubre `![Imagen Generada](...)` y cualquier otra imagen con URL remota
   que la IA haya insertado (no imágenes adjuntas del usuario, que van en
   msg.images como base64 y no en el content). */
const IMAGE_MD_RE = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;

/* Música: lazy matching para permitir ':' dentro de la URL (https://...).
   El prompt viene URI-encoded (encodeURIComponent), termina en `__`. */
const MUSIC_MARKER_RE = /__MUSIC_PLAYER:(https?:\/\/.+?)::(.*?)__/g;

export function extractGalleryItems(chats: GalleryChat[]): GalleryItem[] {
  const items: GalleryItem[] = [];
  const seen = new Set<string>();

  for (const chat of chats || []) {
    const chatTitle = chat.title || 'Chat sin título';
    const fallbackTs = chat.updatedAt || 0;

    for (const msg of chat.messages || []) {
      if (msg.role !== 'assistant' || !msg.content) continue;
      const ts = msg.timestamp || fallbackTs;

      // Imágenes
      for (const match of msg.content.matchAll(IMAGE_MD_RE)) {
        const url = match[1];
        if (seen.has(url)) continue;
        seen.add(url);
        items.push({ kind: 'image', url, chatId: chat.id, chatTitle, messageId: msg.id, timestamp: ts });
      }

      // Música
      for (const match of msg.content.matchAll(MUSIC_MARKER_RE)) {
        const url = match[1];
        if (seen.has(url)) continue;
        seen.add(url);
        let prompt: string | undefined;
        try {
          prompt = match[2] ? decodeURIComponent(match[2]) : undefined;
        } catch {
          prompt = match[2] || undefined;
        }
        items.push({ kind: 'music', url, prompt, chatId: chat.id, chatTitle, messageId: msg.id, timestamp: ts });
      }
    }
  }

  // Más recientes primero
  items.sort((a, b) => b.timestamp - a.timestamp);
  return items;
}
