import { describe, it, expect } from 'vitest';
import { BACKUP_KEYS_TO_CAPTURE, captureAppSnapshot, performAutoBackup, importBackupFile } from '../backup';
import { makeStorage } from './helpers';

describe('captureAppSnapshot', () => {
  it('captura solo claves presentes de la whitelist', () => {
    const storage = makeStorage({
      chimuelo_chats: '[]',
      chimuelo_user_name: 'Rafael',
      clave_ajena: 'no debería salir',
    });
    const snap = captureAppSnapshot(storage);
    expect(snap).toEqual({ chimuelo_chats: '[]', chimuelo_user_name: 'Rafael' });
  });

  it('captura las claves REALES de estilo (regresión del bug camelCase vs snake_case)', () => {
    // La app escribe chimuelo_bubbleStyle y chimuelo_density (camelCase).
    // El bug histórico: la whitelist tenía chimuelo_bubble_style/message_density.
    expect(BACKUP_KEYS_TO_CAPTURE).toContain('chimuelo_bubbleStyle');
    expect(BACKUP_KEYS_TO_CAPTURE).toContain('chimuelo_density');
    const storage = makeStorage({ chimuelo_bubbleStyle: 'flat', chimuelo_density: 'compact' });
    const snap = captureAppSnapshot(storage);
    expect(snap.chimuelo_bubbleStyle).toBe('flat');
    expect(snap.chimuelo_density).toBe('compact');
  });
});

describe('performAutoBackup', () => {
  it('crea backup_v1 con payload versionado', () => {
    const storage = makeStorage({ chimuelo_chats: '[{"id":"1"}]' });
    performAutoBackup(storage);
    const v1 = JSON.parse(storage.getItem('chimuelo_backup_v1')!);
    expect(v1.version).toBe(1);
    expect(v1.data.chimuelo_chats).toBe('[{"id":"1"}]');
    expect(storage.getItem('chimuelo_last_backup_at')).toBeTruthy();
  });

  it('rota v1→v2→v3 en backups sucesivos', () => {
    const storage = makeStorage({ chimuelo_user_name: 'a' });
    performAutoBackup(storage);
    storage.setItem('chimuelo_user_name', 'b');
    performAutoBackup(storage);
    storage.setItem('chimuelo_user_name', 'c');
    performAutoBackup(storage);

    const v1 = JSON.parse(storage.getItem('chimuelo_backup_v1')!);
    const v2 = JSON.parse(storage.getItem('chimuelo_backup_v2')!);
    const v3 = JSON.parse(storage.getItem('chimuelo_backup_v3')!);
    expect(v1.data.chimuelo_user_name).toBe('c');
    expect(v2.data.chimuelo_user_name).toBe('b');
    expect(v3.data.chimuelo_user_name).toBe('a');
  });

  it('no crea backup si no hay nada que respaldar', () => {
    const storage = makeStorage();
    performAutoBackup(storage);
    expect(storage.getItem('chimuelo_backup_v1')).toBeNull();
  });
});

describe('importBackupFile', () => {
  const file = (obj: unknown) => ({ text: async () => JSON.stringify(obj) });

  it('restaura claves de la whitelist y reporta el conteo', async () => {
    const storage = makeStorage();
    const result = await importBackupFile(
      file({ data: { chimuelo_user_name: 'Rafa', chimuelo_theme: 'oled', clave_maliciosa: 'x' } }),
      storage
    );
    expect(result.ok).toBe(true);
    expect(result.msg).toContain('2');
    expect(storage.getItem('chimuelo_user_name')).toBe('Rafa');
    expect(storage.getItem('chimuelo_theme')).toBe('oled');
    expect(storage.getItem('clave_maliciosa')).toBeNull();
  });

  it('rechaza archivo sin estructura .data', async () => {
    const storage = makeStorage();
    const result = await importBackupFile(file({ nada: true }), storage);
    expect(result.ok).toBe(false);
  });

  it('rechaza JSON corrupto sin lanzar excepción', async () => {
    const storage = makeStorage();
    const result = await importBackupFile({ text: async () => 'esto no es json{{{' }, storage);
    expect(result.ok).toBe(false);
  });

  it('hace backup de seguridad ANTES de sobrescribir', async () => {
    const storage = makeStorage({ chimuelo_user_name: 'original' });
    await importBackupFile(file({ data: { chimuelo_user_name: 'importado' } }), storage);
    const backup = JSON.parse(storage.getItem('chimuelo_backup_v1')!);
    expect(backup.data.chimuelo_user_name).toBe('original');
    expect(storage.getItem('chimuelo_user_name')).toBe('importado');
  });
});
