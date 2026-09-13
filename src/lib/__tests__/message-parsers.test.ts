import { describe, it, expect } from 'vitest';
import { stripThinkTags, parseMusicMarker, parseSticker, extractImageUrls, parseSetReminderTag, resolveDisplayContent, userWantsImage, userWantsDocument, userWantsVideo, userWantsGeneratedMedia, liftToolTagsFromThink, unwrapFencedToolTags, wrapTextAsArtifact } from '../message-parsers';

describe('resolveDisplayContent — nunca burbuja fantasma', () => {
  it('devuelve el texto limpio en el caso normal', () => {
    const r = resolveDisplayContent('<think>2+2</think>El resultado es 16.');
    expect(r).toEqual({ content: 'El resultado es 16.', isEmpty: false });
  });

  it('rescata la respuesta cuando el <think> quedó SIN cerrar', () => {
    // Bug real: think abierto dejaba el texto crudo o vacío en el render
    const r = resolveDisplayContent('<think>pensando');
    expect(r.isEmpty).toBe(false);
    expect(r.content).toBe('pensando');
  });

  it('usa el razonamiento si no hay respuesta final (stream cortado)', () => {
    const r = resolveDisplayContent('<think>iba a decir 16</think>');
    expect(r.content).toBe('iba a decir 16');
    expect(r.isEmpty).toBe(false);
  });

  it('marca isEmpty solo cuando de verdad no hay nada', () => {
    expect(resolveDisplayContent('').isEmpty).toBe(true);
    expect(resolveDisplayContent('   ').isEmpty).toBe(true);
    expect(resolveDisplayContent(null).isEmpty).toBe(true);
    expect(resolveDisplayContent(undefined).isEmpty).toBe(true);
  });

  it('no deja burbuja vacía si todo el mensaje era contexto inyectado', () => {
    const soloDoc = '[DOCUMENTO ADJUNTO: cv.pdf]\ncontenido\n[FIN DEL DOCUMENTO]';
    expect(resolveDisplayContent(soloDoc).isEmpty).toBe(true);
  });

  it('conserva la respuesta cuando viene junto a un documento adjunto', () => {
    const r = resolveDisplayContent('[DOCUMENTO ADJUNTO: cv.pdf]\ntexto\n[FIN DEL DOCUMENTO]\n\nTu CV se ve bien.');
    expect(r.content).toBe('Tu CV se ve bien.');
  });
});

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

describe('generación de media', () => {
  it('detecta pedido de imagen', () => {
    expect(userWantsImage('generame una imagen de un gato')).toBe(true);
    expect(userWantsImage('hazme una imagen de un auto')).toBe(true);
    expect(userWantsImage('quiero una foto de un atardecer')).toBe(true);
    expect(userWantsImage('dibújame un dragón')).toBe(true);
    expect(userWantsImage('quiero q me hagas esto en verde')).toBe(true);
    expect(userWantsImage('házmelo en rojo')).toBe(true);
    expect(userWantsImage('crea un logo para mi marca')).toBe(true);
    expect(userWantsImage('hola qué hora es')).toBe(false);
    expect(userWantsImage('hazme un resumen')).toBe(false);
    expect(userWantsImage('cómo saco una buena foto')).toBe(false);
  });

  it('detecta pedido de pdf/documento', () => {
    expect(userWantsDocument('hazme un pdf de mi CV')).toBe(true);
    expect(userWantsDocument('te mando un archivo')).toBe(false);
  });

  it('detecta pedido de video', () => {
    expect(userWantsVideo('generame un video de un gato')).toBe(true);
    expect(userWantsVideo('hazme un reel de la playa')).toBe(true);
    expect(userWantsVideo('generame una imagen de un gato')).toBe(false);
  });

  it('userWantsGeneratedMedia cubre imagen, pdf, música y video', () => {
    expect(userWantsGeneratedMedia('crea una canción de cumbia')).toBe(true);
    expect(userWantsGeneratedMedia('genera una imagen de un dragón')).toBe(true);
    expect(userWantsGeneratedMedia('crea un video de un auto')).toBe(true);
  });

  it('saca etiquetas del bloque think', () => {
    const raw = '<think>voy a generar <generate_image>a red cat</generate_image></think>Listo.';
    const out = liftToolTagsFromThink(raw);
    expect(out).toContain('</think>');
    expect(out).toContain('<generate_image>a red cat</generate_image>');
    expect(out.indexOf('<generate_image>')).toBeGreaterThan(out.indexOf('</think>'));
  });

  it('desenvuelve fences markdown', () => {
    const raw = '```xml\n<generate_image>a dog</generate_image>\n```';
    expect(unwrapFencedToolTags(raw)).toContain('<generate_image>a dog</generate_image>');
    expect(unwrapFencedToolTags(raw)).not.toContain('```');
  });

  it('wrapTextAsArtifact arma un artifact descargable', () => {
    const html = wrapTextAsArtifact('Informe', 'Hola mundo');
    expect(html).toContain('<artifact>');
    expect(html).toContain('Informe');
    expect(html).toContain('Hola mundo');
  });
});
