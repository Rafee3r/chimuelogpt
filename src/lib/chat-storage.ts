/* ─────────── Persistencia de chats en localStorage ───────────
   Lógica pura extraída de page.tsx (Fase 2 del plan de salud del código). */

import type { Chat, StorageLike } from './types';

/* Quita imageData (base64 enorme) y base64 de la lista de imágenes que
   revienta la cuota. Mantiene placeholders y nombres para el historial. */
export function sanitizeChatsForStorage(chats: any[]): any[] {
  return chats.map(c => ({
    ...c,
    messages: (c.messages || []).map((m: any) => {
      const cleaned = { ...m };
      if (cleaned.imageData) {
        delete cleaned.imageData;
      }
      if (cleaned.images && Array.isArray(cleaned.images)) {
        cleaned.images = cleaned.images.map((img: any) => {
          const { base64, ...rest } = img;
          return rest;
        });
      }
      return cleaned;
    })
  }));
}

/* Guarda chats con degradación: primero sanitizados; si aún revienta la
   cuota, sin attachments; si tampoco, avisa y no guarda este turno. */
export function safeSetChats(chats: any[], storage: StorageLike = localStorage): void {
  try {
    storage.setItem("chimuelo_chats", JSON.stringify(sanitizeChatsForStorage(chats)));
  } catch (e) {
    try {
      const stripped = chats.map(c => ({
        ...c,
        messages: (c.messages || []).map((m: any) => {
          const { imageData, docPlaceholder, images, docs, ...rest } = m;
          return rest;
        })
      }));
      storage.setItem("chimuelo_chats", JSON.stringify(stripped));
    } catch {
      console.warn('localStorage lleno — chats no guardados en este turno.');
    }
  }
}

/* Agrupa chats para el sidebar: fijados + hoy / ayer / esta semana / antes.
   `now` inyectable para tests. */
export function groupChatsByDate(chats: Chat[], now: Date = new Date()) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
  const unpinned = chats.filter(c => !c.pinned);
  return {
    pinned: chats.filter(c => c.pinned),
    hoy:    unpinned.filter(c => c.updatedAt >= today.getTime()),
    ayer:   unpinned.filter(c => c.updatedAt >= yesterday.getTime() && c.updatedAt < today.getTime()),
    semana: unpinned.filter(c => c.updatedAt >= weekAgo.getTime() && c.updatedAt < yesterday.getTime()),
    antes:  unpinned.filter(c => c.updatedAt < weekAgo.getTime()),
  };
}
