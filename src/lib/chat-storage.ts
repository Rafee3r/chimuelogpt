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

/* ─────────── ChimuCode Sessions (v1) ─────────── */
import type { ChimuCodeSession, ChimuCodeFile } from './sandbox-types';

export const CHIMUCODE_STORAGE_KEY = 'chimucode-sessions-v1';
export const CHIMUCODE_ACTIVE_ID_KEY = 'chimucode-active-session-id';
const LEGACY_STORAGE_KEYS = ['chimuelo_code_sessions', 'chimucode-sessions', 'chimu-code', 'sessions'];

function normalizeSession(s: any): ChimuCodeSession {
  let files: ChimuCodeFile[] = Array.isArray(s.files) ? s.files : [];
  if (files.length === 0 && s.activeCode) {
    const lang = s.language || 'html';
    const filename = lang === 'html' ? 'index.html' : lang === 'python' ? 'main.py' : 'app.js';
    files = [{ path: filename, language: lang, content: s.activeCode }];
  }
  const activePath = s.activePath || (files.length > 0 ? files[0].path : 'index.html');
  const activeContent = files.find(f => f.path === activePath)?.content || s.activeCode || '';

  // Filtrar mensajes de error como "Error: Unexpected token"
  const rawMsgs = Array.isArray(s.messages) ? s.messages : [];
  const cleanMsgs = rawMsgs.filter((m: any) => {
    if (!m || !m.content || typeof m.content !== 'string') return false;
    const trimmed = m.content.trim();
    if (trimmed.startsWith('Error: Unexpected token') || trimmed.startsWith('⚠️ Error: Unexpected token')) {
      return false;
    }
    return true;
  });

  return {
    id: String(s.id),
    title: s.title || 'Sesión de código',
    messages: cleanMsgs,
    files,
    activePath,
    activeCode: activeContent,
    language: files.find(f => f.path === activePath)?.language || s.language || 'html',
    consoleOutput: s.consoleOutput || null,
    pageContext: s.pageContext || null,
    updatedAt: typeof s.updatedAt === 'number' ? s.updatedAt : Date.now(),
  };
}

/** Carga sesiones desde chimucode-sessions-v1 y migra claves legacy sin borrarlas. */
export function loadChimuCodeSessions(storage: StorageLike = localStorage): ChimuCodeSession[] {
  const sessionsMap = new Map<string, ChimuCodeSession>();

  // 1. Clave canónica v1
  const v1Raw = storage.getItem(CHIMUCODE_STORAGE_KEY);
  if (v1Raw) {
    try {
      const parsed = JSON.parse(v1Raw);
      if (Array.isArray(parsed)) {
        for (const s of parsed) {
          if (s && s.id) {
            sessionsMap.set(String(s.id), normalizeSession(s));
          }
        }
      }
    } catch {}
  }

  // 2. Claves legacy sin borrarlas
  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    const raw = storage.getItem(legacyKey);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const s of parsed) {
          if (s && s.id && !sessionsMap.has(String(s.id))) {
            sessionsMap.set(String(s.id), normalizeSession(s));
          }
        }
      }
    } catch {}
  }

  const list = Array.from(sessionsMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  if (list.length > 0 && !v1Raw) {
    try {
      storage.setItem(CHIMUCODE_STORAGE_KEY, JSON.stringify(list));
    } catch {}
  }
  return list;
}

/** Guarda sesiones asegurando deduplicación estricta por ID */
export function saveChimuCodeSessions(sessions: ChimuCodeSession[], storage: StorageLike = localStorage): void {
  const sessionsMap = new Map<string, ChimuCodeSession>();
  for (const s of sessions) {
    if (s && s.id) {
      sessionsMap.set(String(s.id), normalizeSession(s));
    }
  }
  const list = Array.from(sessionsMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  try {
    storage.setItem(CHIMUCODE_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('No se pudo guardar chimucode-sessions-v1 en localStorage:', e);
  }
}

/** Borra una única sesión por ID tras confirmación */
export function deleteChimuCodeSession(id: string, storage: StorageLike = localStorage): ChimuCodeSession[] {
  const current = loadChimuCodeSessions(storage);
  const next = current.filter(s => s.id !== id);
  saveChimuCodeSessions(next, storage);
  return next;
}

export const CHIMUCODE_ACTIVE_SESSION_KEY = 'chimucode-active-session-id';
export const CHIMUCODE_LAST_OPENED_KEY = 'chimucode-last-opened-id';

/** Obtiene el ID de la última sesión abierta de ChimuCode */
export function getLastOpenedChimuSessionId(storage: StorageLike = localStorage): string | null {
  try {
    return storage.getItem(CHIMUCODE_ACTIVE_SESSION_KEY) || storage.getItem(CHIMUCODE_LAST_OPENED_KEY) || null;
  } catch {
    return null;
  }
}

/** Guarda o limpia el ID de la última sesión abierta de ChimuCode */
export function setLastOpenedChimuSessionId(id: string | null, storage: StorageLike = localStorage): void {
  try {
    if (id && id !== 'new') {
      storage.setItem(CHIMUCODE_ACTIVE_SESSION_KEY, id);
      storage.setItem(CHIMUCODE_LAST_OPENED_KEY, id);
    } else {
      storage.removeItem(CHIMUCODE_ACTIVE_SESSION_KEY);
      storage.removeItem(CHIMUCODE_LAST_OPENED_KEY);
    }
  } catch {}
}

