import { describe, it, expect } from 'vitest';
import {
  buildVisionMessages, filterUsableImages, base64ByteSize,
  MAX_IMAGE_BYTES, VISION_MODEL,
} from '../vision-payload';

const jpeg = (payload = 'AAAA') => `data:image/jpeg;base64,${payload}`;

describe('buildVisionMessages', () => {
  it('adjunta las imágenes al turno del usuario en formato image_url', () => {
    const msgs = buildVisionMessages('eres util', [], '¿qué es esto?', [jpeg()]);
    const last = msgs[msgs.length - 1];
    expect(last.role).toBe('user');
    const parts = last.content as any[];
    expect(parts[0]).toEqual({ type: 'text', text: '¿qué es esto?' });
    expect(parts[1]).toEqual({ type: 'image_url', image_url: { url: jpeg() } });
  });

  it('NUNCA pone imágenes en system o assistant (la API lo rechaza)', () => {
    const history = [
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: '¡hola!' },
    ];
    const msgs = buildVisionMessages('sistema', history, 'mira', [jpeg()]);
    const conImagen = msgs.filter(m =>
      Array.isArray(m.content) && m.content.some((p: any) => p.type === 'image_url'));
    expect(conImagen).toHaveLength(1);
    expect(conImagen[0].role).toBe('user');
    expect(msgs[0].role).toBe('system');
    expect(typeof msgs[0].content).toBe('string');
  });

  it('conserva el historial para no perder el hilo', () => {
    const history = [
      { role: 'user', content: 'cuánto es 4x4' },
      { role: 'assistant', content: '16' },
    ];
    const msgs = buildVisionMessages('sys', history, 'y esta foto?', [jpeg()]);
    expect(msgs).toHaveLength(4); // system + 2 previos + turno actual
    expect(msgs[1].content).toBe('cuánto es 4x4');
  });

  it('funciona sin imágenes y con texto vacío', () => {
    const msgs = buildVisionMessages('sys', [], '', []);
    const parts = msgs[msgs.length - 1].content as any[];
    expect(parts[0].text).toBe('Describe esta imagen.');
    expect(parts.some(p => p.type === 'image_url')).toBe(false);
  });
});

describe('filterUsableImages — evitar un 400 seguro', () => {
  it('acepta los formatos soportados', () => {
    const imgs = [
      'data:image/jpeg;base64,AAAA',
      'data:image/png;base64,AAAA',
      'data:image/gif;base64,AAAA',
      'data:image/webp;base64,AAAA',
    ];
    expect(filterUsableImages(imgs).usable).toHaveLength(4);
  });

  it('descarta formatos no soportados', () => {
    const r = filterUsableImages(['data:image/bmp;base64,AAAA', 'data:application/pdf;base64,AAAA']);
    expect(r.usable).toHaveLength(0);
    expect(r.skipped).toBe(2);
  });

  it('descarta imágenes por encima del límite de 32 MiB', () => {
    const enorme = `data:image/jpeg;base64,${'A'.repeat(MAX_IMAGE_BYTES * 2)}`;
    const r = filterUsableImages([enorme]);
    expect(r.usable).toHaveLength(0);
    expect(r.skipped).toBe(1);
  });

  it('acepta URLs remotas sin inspeccionar el mime', () => {
    expect(filterUsableImages(['https://ejemplo.com/foto.jpg']).usable).toHaveLength(1);
  });

  it('tolera entradas basura sin romper', () => {
    const r = filterUsableImages(['', null as any, undefined as any, 123 as any]);
    expect(r.usable).toHaveLength(0);
    expect(r.skipped).toBe(4);
  });
});

describe('base64ByteSize', () => {
  it('estima el tamaño descontando el padding', () => {
    expect(base64ByteSize('data:image/png;base64,QUJD')).toBe(3);      // "ABC"
    expect(base64ByteSize('data:image/png;base64,QUI=')).toBe(2);      // "AB"
  });
  it('devuelve 0 si no hay datos', () => {
    expect(base64ByteSize('')).toBe(0);
  });
});

describe('modelo de visión', () => {
  it('usa el único modelo con soporte de imágenes', () => {
    expect(VISION_MODEL).toBe('deepseek-v4-flash-vision-exp');
  });
});
