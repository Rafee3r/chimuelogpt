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

describe('ChimuCode sessions storage & migration', () => {
  it('guarda y carga sesiones en chimucode-sessions-v1 preservando files y activePath', async () => {
    const { loadChimuCodeSessions, saveChimuCodeSessions, CHIMUCODE_STORAGE_KEY } = await import('../chat-storage');
    const storage = makeStorage();

    const sampleSessions = [
      {
        id: 'sess-1',
        title: 'Proyecto Petra',
        messages: [{ id: 'm1', role: 'user' as const, content: 'hola' }],
        files: [{ path: 'petra/index.html', language: 'html' as const, content: '<h1>Petra</h1>' }],
        activePath: 'petra/index.html',
        updatedAt: Date.now(),
      },
    ];

    saveChimuCodeSessions(sampleSessions, storage);
    expect(storage.getItem(CHIMUCODE_STORAGE_KEY)).toBeDefined();

    const loaded = loadChimuCodeSessions(storage);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('sess-1');
    expect(loaded[0].title).toBe('Proyecto Petra');
    expect(loaded[0].files).toHaveLength(1);
    expect(loaded[0].files[0].path).toBe('petra/index.html');
  });

  it('migra sesiones de claves legacy sin borrarlas', async () => {
    const { loadChimuCodeSessions, CHIMUCODE_STORAGE_KEY } = await import('../chat-storage');
    const storage = makeStorage();

    const legacyData = [
      {
        id: 'legacy-1',
        title: 'Sesión Antigua',
        messages: [{ id: 'm0', role: 'user' as const, content: 'crea app' }],
        activeCode: 'console.log(1)',
        language: 'javascript' as const,
        updatedAt: 12345,
      },
    ];
    storage.setItem('chimucode-sessions', JSON.stringify(legacyData));

    const loaded = loadChimuCodeSessions(storage);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('legacy-1');
    expect(loaded[0].files[0].path).toBe('app.js');
    expect(loaded[0].files[0].content).toBe('console.log(1)');

    // Clave legacy NO debe ser borrada
    expect(storage.getItem('chimucode-sessions')).toBe(JSON.stringify(legacyData));
    // Clave nueva chimucode-sessions-v1 debe haber sido poblada
    expect(storage.getItem(CHIMUCODE_STORAGE_KEY)).toBeDefined();
  });

  it('elimina solo la sesión especificada en deleteChimuCodeSession', async () => {
    const { loadChimuCodeSessions, saveChimuCodeSessions, deleteChimuCodeSession } = await import('../chat-storage');
    const storage = makeStorage();

    const sessions = [
      { id: 's1', title: 'Uno', messages: [], files: [], activePath: 'index.html', updatedAt: 1 },
      { id: 's2', title: 'Dos', messages: [], files: [], activePath: 'index.html', updatedAt: 2 },
    ];
    saveChimuCodeSessions(sessions, storage);

    deleteChimuCodeSession('s1', storage);
    const remaining = loadChimuCodeSessions(storage);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('s2');
  });

  it('filtra mensajes corruptos con Error: Unexpected token y persiste pageContext', async () => {
    const { loadChimuCodeSessions, saveChimuCodeSessions } = await import('../chat-storage');
    const storage = makeStorage();

    const sessionWithErrors = [
      {
        id: 's-vada',
        title: 'Vada CL',
        messages: [
          { id: 'm1', role: 'user' as const, content: 'landing de vada.cl' },
          { id: 'm2', role: 'assistant' as const, content: '⚠️ Error: Unexpected token < in JSON' },
          { id: 'm3', role: 'assistant' as const, content: 'Error: Unexpected token d, data: {"type": ...' },
          { id: 'm4', role: 'user' as const, content: 'con todo' },
        ],
        files: [],
        activePath: 'index.html',
        pageContext: {
          url: 'https://vada.cl',
          title: 'VADA Chile',
          text: 'Tiras de blanqueamiento dental sin peróxido por $29.900.',
        },
        updatedAt: 100,
      },
    ];

    saveChimuCodeSessions(sessionWithErrors, storage);
    const loaded = loadChimuCodeSessions(storage);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].messages).toHaveLength(2);
    expect(loaded[0].messages.map((m) => m.content)).toEqual(['landing de vada.cl', 'con todo']);
    expect(loaded[0].pageContext).toBeDefined();
    expect(loaded[0].pageContext?.url).toBe('https://vada.cl');
    expect(loaded[0].pageContext?.title).toBe('VADA Chile');
  });
});


