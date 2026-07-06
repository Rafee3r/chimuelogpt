import { describe, it, expect } from 'vitest';
import { stripThinkTags, parseMusicMarker, parseSticker, extractImageUrls, parseSetReminderTag } from '../message-parsers';

describe('stripThinkTags', () => {
  it('quita el bloque think y conserva el resto', () => {
    expect(stripThinkTags('<think>razonando...</think>Hola!')).toBe('Hola!');
  });
  it('tolera contenido sin think', () => {
    expect(stripThinkTags('solo texto')).toBe('solo texto');
  });
});

describe('parseMusicMarker', () => {
  it('extrae url y prompt decodificado', () => {
    const content = `¡Lista! __MUSIC_PLAYER:https://cdn.fal.ai/audio/abc.mp3::${encodeURIComponent('rap chileno 90bpm')}__`;
    const result = parseMusicMarker(content)!;
    expect(result.url).toBe('https://cdn.fal.ai/audio/abc.mp3');
    expect(result.prompt).toBe('rap chileno 90bpm');
  });

  it('soporta URLs con dos puntos (https://)', () => {
    const result = parseMusicMarker('__MUSIC_PLAYER:https://host:8080/a.mp3::x__')!;
    expect(result.url).toBe('https://host:8080/a.mp3');
  });

  it('retorna null sin marcador', () => {
    expect(parseMusicMarker('sin música aquí')).toBeNull();
  });
});

describe('parseSticker', () => {
  it('extrae emoji y texto restante', () => {
    const result = parseSticker('qué lindo\n<sticker>🥰</sticker>')!;
    expect(result.emoji).toBe('🥰');
    expect(result.rest).toBe('qué lindo');
  });
  it('retorna null sin sticker', () => {
    expect(parseSticker('hola')).toBeNull();
  });
});

describe('extractImageUrls', () => {
  it('extrae múltiples imágenes de un mensaje', () => {
    const urls = extractImageUrls('![Imagen Generada](https://a.com/1.png) y ![otra](https://a.com/2.png)');
    expect(urls).toEqual(['https://a.com/1.png', 'https://a.com/2.png']);
  });
  it('ignora imágenes con rutas no-http (base64, relativas)', () => {
    expect(extractImageUrls('![x](data:image/png;base64,AAA) ![y](/local.png)')).toEqual([]);
  });
});

describe('parseSetReminderTag', () => {
  it('extrae texto, fecha y repeat', () => {
    const r = parseSetReminderTag('Ya, te aviso. <set_reminder date="2026-06-11T09:00" repeat="daily">Comprar pan</set_reminder>')!;
    expect(r.text).toBe('Comprar pan');
    expect(r.dueAt).toBe(Date.parse('2026-06-11T09:00'));
    expect(r.repeat).toBe('daily');
    expect(r.rest).toBe('Ya, te aviso.');
  });

  it('tolera tag sin cerrar (stream a medias)', () => {
    const r = parseSetReminderTag('<set_reminder date="2026-06-11T09:00">Comprar pan')!;
    expect(r.text).toBe('Comprar pan');
  });

  it('dueAt null con fecha inválida', () => {
    const r = parseSetReminderTag('<set_reminder date="mañana como a las 9">Algo</set_reminder>')!;
    expect(r.dueAt).toBeNull();
  });

  it('retorna null si no hay texto', () => {
    expect(parseSetReminderTag('<set_reminder date="2026-06-11"></set_reminder>')).toBeNull();
  });
});
