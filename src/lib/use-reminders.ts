/* ─────────── Hook de recordatorios ───────────
   - Revisa recordatorios vencidos al montar y cada 45s con la app abierta.
   - Notifica vía Service Worker (registration.showNotification) porque en
     iOS PWA el constructor `new Notification()` NO funciona; el SW sí.
   - Siempre expone los vencidos como `dueNow` para un fallback in-app
     (banner/toast) por si el permiso está denegado.
*/

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  loadReminders, getDueReminders, markReminderFired, pruneOldReminders,
  addReminder, deleteReminder, markReminderDone, type Reminder,
} from './reminders';

const CHECK_INTERVAL_MS = 45_000;

export type NotifPermission = 'default' | 'granted' | 'denied' | 'unsupported';

async function fireNotification(reminder: Reminder) {
  const title = 'Chimuelo — Recordatorio';
  const body = reminder.text;
  try {
    // iOS PWA: usar el Service Worker registration
    if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, { body, icon: '/icon-192.png', tag: reminder.id });
        return;
      }
    }
    // Desktop fallback
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icon-192.png' });
    }
  } catch {
    // silencio — el fallback in-app cubre esto
  }
}

export function useReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [dueNow, setDueNow] = useState<Reminder[]>([]);
  const [permission, setPermission] = useState<NotifPermission>('default');
  const firedRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(() => {
    setReminders(loadReminders());
  }, []);

  // Estado inicial + permiso actual
  useEffect(() => {
    refresh();
    pruneOldReminders();
    if (typeof Notification === 'undefined') setPermission('unsupported');
    else setPermission(Notification.permission as NotifPermission);
  }, [refresh]);

  // Chequeo periódico de vencidos
  useEffect(() => {
    const check = () => {
      const due = getDueReminders();
      if (due.length === 0) { setDueNow([]); return; }
      setDueNow(due);
      for (const r of due) {
        if (firedRef.current.has(r.id)) continue;
        firedRef.current.add(r.id);
        fireNotification(r);
        markReminderFired(r.id);
      }
      refresh();
    };
    check();
    const iv = setInterval(check, CHECK_INTERVAL_MS);
    // Re-chequear al volver a foco (usuario reabre la PWA)
    const onVis = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); };
  }, [refresh]);

  const requestPermission = useCallback(async (): Promise<NotifPermission> => {
    if (typeof Notification === 'undefined') { setPermission('unsupported'); return 'unsupported'; }
    try {
      const p = (await Notification.requestPermission()) as NotifPermission;
      setPermission(p);
      return p;
    } catch {
      return Notification.permission as NotifPermission;
    }
  }, []);

  const create = useCallback((input: Parameters<typeof addReminder>[0]) => {
    const r = addReminder(input);
    refresh();
    // Pedir permiso la primera vez que el usuario crea uno (no al abrir la app)
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      requestPermission();
    }
    return r;
  }, [refresh, requestPermission]);

  const remove = useCallback((id: string) => { deleteReminder(id); refresh(); }, [refresh]);
  const complete = useCallback((id: string) => { markReminderDone(id); firedRef.current.delete(id); refresh(); }, [refresh]);

  return { reminders, dueNow, permission, requestPermission, create, remove, complete, refresh };
}
