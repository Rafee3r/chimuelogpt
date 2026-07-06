/* ─────────── SISTEMA DE BACKUP LOCAL ───────────
   Captura TODO el estado de la app y permite:
   1. Auto-respaldo rotativo (3 versiones, 1 cada 30 min)
   2. Export a archivo JSON descargable
   3. Import desde archivo JSON (restaura todo)
   Las 3 versiones rotativas viven en localStorage como cinturón de
   seguridad si las claves principales se corrompen o borran.
   Extraído de page.tsx en Fase 2 (salud del código). */

import type { StorageLike } from './types';

export const BACKUP_KEYS_TO_CAPTURE = [
  'chimuelo_chats',
  'chimuelo_subjects',
  'chimuelo_active_subject',
  'chimuelo_current_chat',
  'chimuelo_memory',
  'chimuelo_memoryEnabled',
  'chimuelo_user_name',
  'chimuelo_onboarding_done',
  'chimuelo_show_cat',
  'chimuelo_version',
  'chimuelo_model',
  'chimuelo_theme',
  'chimuelo_persona',
  'chimuelo_custom_instructions',
  // Keys REALES que usa la UI (bug histórico: se listaban variantes
  // snake_case que la app nunca escribe)
  'chimuelo_bubbleStyle',
  'chimuelo_density',
  'chimuelo_fontSize',
  'chimuelo_enterToSend',
  'chimuelo_reminders',
];

export function captureAppSnapshot(storage: StorageLike = localStorage): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (const key of BACKUP_KEYS_TO_CAPTURE) {
    const v = storage.getItem(key);
    if (v !== null) snapshot[key] = v;
  }
  return snapshot;
}

export function performAutoBackup(storage: StorageLike = localStorage): void {
  try {
    const snapshot = captureAppSnapshot(storage);
    if (Object.keys(snapshot).length === 0) return;
    const payload = JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      data: snapshot
    });
    // Rotación: backup_v1 (más reciente), v2, v3 (más antiguo)
    const prevV1 = storage.getItem('chimuelo_backup_v1');
    const prevV2 = storage.getItem('chimuelo_backup_v2');
    if (prevV2) storage.setItem('chimuelo_backup_v3', prevV2);
    if (prevV1) storage.setItem('chimuelo_backup_v2', prevV1);
    storage.setItem('chimuelo_backup_v1', payload);
    storage.setItem('chimuelo_last_backup_at', Date.now().toString());
  } catch (e) {
    console.warn('Auto-backup falló:', e);
  }
}

export function downloadBackupFile(storage: StorageLike = localStorage): void {
  const snapshot = captureAppSnapshot(storage);
  const payload = {
    app: 'Chimuelo',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: snapshot
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fecha = new Date().toISOString().split('T')[0];
  a.download = `chimuelo-backup-${fecha}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importBackupFile(
  file: { text(): Promise<string> },
  storage: StorageLike = localStorage
): Promise<{ ok: boolean; msg: string }> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed.data || typeof parsed.data !== 'object') {
      return { ok: false, msg: 'Archivo no válido (estructura incorrecta).' };
    }
    // Backup actual antes de sobrescribir
    performAutoBackup(storage);
    // Restaurar solo claves de la whitelist
    let restored = 0;
    for (const [key, value] of Object.entries(parsed.data)) {
      if (BACKUP_KEYS_TO_CAPTURE.includes(key) && typeof value === 'string') {
        storage.setItem(key, value);
        restored++;
      }
    }
    return { ok: true, msg: `Restauradas ${restored} claves. Recargando…` };
  } catch (e: any) {
    return { ok: false, msg: 'Error: ' + (e?.message || 'archivo dañado') };
  }
}
