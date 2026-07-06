import { describe, it, expect } from 'vitest';
import {
  addReminder, loadReminders, deleteReminder, markReminderDone,
  getDueReminders, markReminderFired, pruneOldReminders, REMINDERS_KEY,
} from '../reminders';
import { makeStorage } from './helpers';

describe('reminders CRUD', () => {
  it('crea y persiste un recordatorio', () => {
    const s = makeStorage();
    const r = addReminder({ text: 'Comprar pan', dueAt: 123456 }, s);
    expect(r.status).toBe('pending');
    expect(r.createdBy).toBe('user');
    expect(loadReminders(s)).toHaveLength(1);
  });

  it('trunca textos larguísimos a 200 chars', () => {
    const s = makeStorage();
    const r = addReminder({ text: 'x'.repeat(500), dueAt: 1 }, s);
    expect(r.text).toHaveLength(200);
  });

  it('borra y marca como hecho', () => {
    const s = makeStorage();
    const a = addReminder({ text: 'a', dueAt: 1 }, s);
    const b = addReminder({ text: 'b', dueAt: 2 }, s);
    deleteReminder(a.id, s);
    markReminderDone(b.id, s);
    const all = loadReminders(s);
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('done');
  });

  it('tolera storage corrupto', () => {
    const s = makeStorage({ [REMINDERS_KEY]: 'no es json{{' });
    expect(loadReminders(s)).toEqual([]);
  });
});

describe('getDueReminders + markReminderFired', () => {
  it('retorna solo pendientes vencidos', () => {
    const s = makeStorage();
    addReminder({ text: 'vencido', dueAt: 1000 }, s);
    addReminder({ text: 'futuro', dueAt: 99999 }, s);
    const due = getDueReminders(5000, s);
    expect(due.map(r => r.text)).toEqual(['vencido']);
  });

  it('fired no vuelve a aparecer como due', () => {
    const s = makeStorage();
    const r = addReminder({ text: 'x', dueAt: 1000 }, s);
    markReminderFired(r.id, s);
    expect(getDueReminders(5000, s)).toHaveLength(0);
  });

  it('repeat=daily re-agenda la siguiente ocurrencia futura', () => {
    const s = makeStorage();
    const r = addReminder({ text: 'diario', dueAt: Date.now() - 3 * 24 * 3600_000, repeat: 'daily' }, s);
    markReminderFired(r.id, s);
    const all = loadReminders(s);
    const next = all.find(x => x.status === 'pending');
    expect(next).toBeTruthy();
    expect(next!.dueAt).toBeGreaterThan(Date.now());
    // No debe crear ráfaga de ocurrencias perdidas
    expect(all.filter(x => x.status === 'pending')).toHaveLength(1);
  });
});

describe('pruneOldReminders', () => {
  it('limpia resueltos viejos, conserva pendientes', () => {
    const s = makeStorage();
    const viejo = addReminder({ text: 'viejo', dueAt: 1000 }, s);
    markReminderDone(viejo.id, s);
    addReminder({ text: 'pendiente antiguo', dueAt: 2000 }, s);
    pruneOldReminders(Date.now(), s);
    const all = loadReminders(s);
    expect(all.map(r => r.text)).toEqual(['pendiente antiguo']);
  });
});
