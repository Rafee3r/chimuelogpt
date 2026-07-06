import { describe, it, expect } from 'vitest';
import { extractGalleryItems } from '../gallery';

const chatWith = (content: string, over: Record<string, unknown> = {}) => ({
  id: 'c1',
  title: 'Mi chat',
  updatedAt: 1000,
  messages: [{ id: 'm1', role: 'assistant', content, timestamp: 2000 }],
  ...over,
});

describe('extractGalleryItems', () => {
  it('extrae imágenes generadas del markdown', () => {
    const items = extractGalleryItems([chatWith('¡Aquí tienes! ![Imagen Generada](https://cdn.fal.ai/img/1.png)')]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'image', url: 'https://cdn.fal.ai/img/1.png', chatId: 'c1', chatTitle: 'Mi chat', timestamp: 2000 });
  });

  it('extrae música con prompt decodificado', () => {
    const items = extractGalleryItems([chatWith(`__MUSIC_PLAYER:https://cdn.fal.ai/a.mp3::${encodeURIComponent('cumbia alegre')}__`)]);
    expect(items[0]).toMatchObject({ kind: 'music', url: 'https://cdn.fal.ai/a.mp3', prompt: 'cumbia alegre' });
  });

  it('ignora mensajes del usuario', () => {
    const chat = chatWith('', { messages: [{ id: 'm1', role: 'user', content: '![foto](https://x.com/1.png)' }] });
    expect(extractGalleryItems([chat])).toHaveLength(0);
  });

  it('deduplica por URL', () => {
    const chat = chatWith('![a](https://x.com/1.png) ![b](https://x.com/1.png)');
    expect(extractGalleryItems([chat])).toHaveLength(1);
  });

  it('ordena más recientes primero y usa updatedAt como fallback', () => {
    const items = extractGalleryItems([
      { id: 'viejo', title: 'V', updatedAt: 100, messages: [{ id: 'a', role: 'assistant', content: '![x](https://x.com/old.png)' }] },
      { id: 'nuevo', title: 'N', updatedAt: 900, messages: [{ id: 'b', role: 'assistant', content: '![x](https://x.com/new.png)' }] },
    ]);
    expect(items.map(i => i.url)).toEqual(['https://x.com/new.png', 'https://x.com/old.png']);
  });

  it('tolera chats vacíos y sin mensajes', () => {
    expect(extractGalleryItems([])).toEqual([]);
    expect(extractGalleryItems([{ id: 'x', messages: undefined } as any])).toEqual([]);
  });
});
