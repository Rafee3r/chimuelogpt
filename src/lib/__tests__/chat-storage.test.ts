import { describe, it, expect } from 'vitest';
import { sanitizeChatsForStorage, safeSetChats, groupChatsByDate } from '../chat-storage';
import { makeStorage } from './helpers';
import type { Chat } from '../types';

describe('sanitizeChatsForStorage', () => {
  it('elimina imageData y base64 de images, conservando nombres', () => {
    const chats = [{
      id: '1',
      messages: [{
        id: 'm1',
        role: 'user',
        content: 'mira',
        imageData: 'data:image/jpeg;base64,AAAA',
        images: [{ base64: 'data:...', name: 'foto.jpg', type: 'image/jpeg' }],
      }],
    }];
    const out = sanitizeChatsForStorage(chats);
    expect(out[0].messages[0].imageData).toBeUndefined();
    expect(out[0].messages[0].images[0].base64).toBeUndefined();
    expect(out[0].messages[0].images[0].name).toBe('foto.jpg');
    expect(out[0].messages[0].content).toBe('mira');
  });

  it('no muta el array original', () => {
    const chats = [{ id: '1', messages: [{ id: 'm1', imageData: 'x', role: 'user', content: '' }] }];
    sanitizeChatsForStorage(chats);
    expect((chats[0].messages[0] as any).imageData).toBe('x');
  });

  it('tolera chats sin messages', () => {
    expect(() => sanitizeChatsForStorage([{ id: '1' }])).not.toThrow();
  });
});

describe('safeSetChats', () => {
  it('guarda chats sanitizados bajo chimuelo_chats', () => {
    const storage = makeStorage();
    safeSetChats([{ id: '1', messages: [{ id: 'm', role: 'user', content: 'hola', imageData: 'big' }] }], storage);
    const saved = JSON.parse(storage.getItem('chimuelo_chats')!);
    expect(saved[0].messages[0].content).toBe('hola');
    expect(saved[0].messages[0].imageData).toBeUndefined();
  });

  it('degrada a versión sin attachments si la cuota revienta', () => {
    let calls = 0;
    const storage = makeStorage();
    const quotaStorage = {
      ...storage,
      setItem: (k: string, v: string) => {
        calls++;
        if (calls === 1) throw new Error('QuotaExceeded');
        storage.setItem(k, v);
      },
    };
    safeSetChats([{ id: '1', messages: [{ id: 'm', role: 'user', content: 'hola', images: [{ name: 'a.jpg' }] }] }], quotaStorage);
    const saved = JSON.parse(storage.getItem('chimuelo_chats')!);
    expect(saved[0].messages[0].content).toBe('hola');
    expect(saved[0].messages[0].images).toBeUndefined();
  });
});

describe('groupChatsByDate', () => {
  const now = new Date('2026-06-10T15:00:00');
  const chat = (id: string, when: string, pinned = false): Chat => ({
    id, title: id, messages: [], updatedAt: new Date(when).getTime(), pinned,
  });

  it('agrupa en hoy / ayer / semana / antes', () => {
    const g = groupChatsByDate([
      chat('hoy', '2026-06-10T09:00:00'),
      chat('ayer', '2026-06-09T22:00:00'),
      chat('semana', '2026-06-05T12:00:00'),
      chat('viejo', '2026-05-01T12:00:00'),
    ], now);
    expect(g.hoy.map(c => c.id)).toEqual(['hoy']);
    expect(g.ayer.map(c => c.id)).toEqual(['ayer']);
    expect(g.semana.map(c => c.id)).toEqual(['semana']);
    expect(g.antes.map(c => c.id)).toEqual(['viejo']);
  });

  it('los fijados salen del flujo por fecha', () => {
    const g = groupChatsByDate([chat('fijado', '2026-06-10T09:00:00', true)], now);
    expect(g.pinned.map(c => c.id)).toEqual(['fijado']);
    expect(g.hoy).toEqual([]);
  });
});
