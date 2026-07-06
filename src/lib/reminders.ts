/* ─────────── RECORDATORIOS (MVP local) ───────────
   CRUD sobre localStorage. Los recordatorios suenan cuando la app está
   abierta (Notification via Service Worker en iOS PWA); si está cerrada,
   se muestran al volver a entrar. Push real con app cerrada = fase futura
   (el modelo de datos ya es serializable para sync).

   Los agentes crean recordatorios emitiendo el tag:
   <set_reminder date="2026-06-11T09:00" repeat="daily">texto</set_reminder>
   (parseado por parseSetReminderTag en message-parsers.ts) */

import type { StorageLike } from './types';

export type Reminder = {
  id: string;
  text: string;
  /* epoch ms */
  dueAt: number;
  createdAt: number;
  /* 'user' o el id del agente que lo creó */
  createdBy: string;
  chatId?: string;
  status: 'pending' | 'fired' | 'done';
  repeat?: 'daily' | 'weekly';
};

export const REMINDERS_KEY = 'chimuelo_reminders';

export function loadReminders(storage: StorageLike = localStorage): Reminder[] {
  try {
    const raw = storage.getItem(REMINDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(r => r && r.id && r.text) : [];
  } catch {
    return [];
  }
}

export function saveReminders(reminders: Reminder[], storage: StorageLike = localStorage): void {
  try {
    storage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
  } catch (e) {
    console.warn('No se pudieron guardar recordatorios:', e);
  }
}

export function addReminder(
  input: { text: string; dueAt: number; createdBy?: string; chatId?: string; repeat?: 'daily' | 'weekly' },
  storage: StorageLike = localStorage
): Reminder {
  const reminder: Reminder = {
    id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text: input.text.trim().slice(0, 200),
    dueAt: input.dueAt,
    createdAt: Date.now(),
    createdBy: input.createdBy || 'user',
    chatId: input.chatId,
    status: 'pending',
    repeat: input.repeat,
  };
  const all = loadReminders(storage);
  all.push(reminder);
  saveReminders(all, storage);
  return reminder;
}

export function deleteReminder(id: string, storage: StorageLike = localStorage): void {
  saveReminders(loadReminders(storage).filter(r => r.id !== id), storage);
}

export function markReminderDone(id: string, storage: StorageLike = localStorage): void {
  saveReminders(
    loadReminders(storage).map(r => (r.id === id ? { ...r, status: 'done' as const } : r)),
    storage
  );
}

/* Recordatorios vencidos que aún no se han notificado */
export function getDueReminders(now: number = Date.now(), storage: StorageLike = localStorage): Reminder[] {
  return loadReminders(storage).filter(r => r.status === 'pending' && r.dueAt <= now);
}

/* Marca como notificado. Si tiene repeat, re-agenda la siguiente ocurrencia
   como un pending nuevo (mismo id + sufijo para no duplicar historial). */
export function markReminderFired(id: string, storage: StorageLike = localStorage): void {
  const all = loadReminders(storage);
  const idx = all.findIndex(r => r.id === id);
  if (idx === -1) return;
  const r = all[idx];
  all[idx] = { ...r, status: 'fired' };
  if (r.repeat) {
    const interval = r.repeat === 'daily' ? 24 * 3600_000 : 7 * 24 * 3600_000;
    // Avanza desde el dueAt original hasta pasar "ahora" (evita ráfaga si
    // estuvo días sin abrirse la app)
    let nextDue = r.dueAt + interval;
    const now = Date.now();
    while (nextDue <= now) nextDue += interval;
    all.push({
      ...r,
      id: `${r.id}_n${nextDue}`,
      dueAt: nextDue,
      createdAt: Date.now(),
      status: 'pending',
    });
  }
  saveReminders(all, storage);
}

/* Limpia recordatorios viejos ya resueltos (fired/done hace +30 días) */
export function pruneOldReminders(now: number = Date.now(), storage: StorageLike = localStorage): void {
  const cutoff = now - 30 * 24 * 3600_000;
  const all = loadReminders(storage);
  const kept = all.filter(r => r.status === 'pending' || r.dueAt > cutoff);
  if (kept.length !== all.length) saveReminders(kept, storage);
}
