import { describe, it, expect } from 'vitest';
import { buildApiHistory, trimHistory, MAX_HISTORY_MESSAGES } from '../chat-context';
import type { BaseMessage } from '../types';

const msg = (id: string, role: 'user' | 'assistant', content: string): BaseMessage =>
  ({ id, role, content } as BaseMessage);

describe('buildApiHistory — la IA debe recordar el hilo', () => {
  it('conserva los turnos previos (bug del "¿Cuánto es qué?")', () => {
    const prev = [
      msg('u1', 'user', 'cuanto es 4 × 4'),
      msg('a1', 'assistant', '16'),
    ];
    const h = buildApiHistory(prev, 'cuanto es');
    expect(h).toHaveLength(3);
    expect(h[0].content).toBe('cuanto es 4 × 4');
    expect(h[1].content).toBe('16');
    expect(h[2]).toEqual({ role: 'user', content: 'cuanto es' });
  });

  it('no duplica el mensaje del usuario recién agregado al state', () => {
    // El state ya puede contener el turno actual: se excluye por id
    const withCurrent = [
      msg('u1', 'user', 'hola'),
      msg('a1', 'assistant', '¡Hola!'),
      msg('u2', 'user', 'texto original'),
    ];
    const h = buildApiHistory(withCurrent, 'texto final con documento', 'u2');
    expect(h).toHaveLength(3);
    expect(h.filter(m => m.content.includes('texto')).length).toBe(1);
    expect(h[2].content).toBe('texto final con documento');
  });

  it('funciona igual si el state aún NO tiene el turno actual (stale)', () => {
    const stale = [msg('u1', 'user', 'hola'), msg('a1', 'assistant', '¡Hola!')];
    const h = buildApiHistory(stale, 'segunda pregunta', 'u2');
    expect(h).toHaveLength(3);
    expect(h[2].content).toBe('segunda pregunta');
  });

  it('descarta respuestas vacías que romperían la alternancia', () => {
    const withEmpty = [
      msg('u1', 'user', 'cuanto es 4 × 4'),
      msg('a1', 'assistant', ''),       // burbuja fantasma
      msg('u2', 'user', 'perdona'),
      msg('a2', 'assistant', 'No pasa nada'),
    ];
    const h = buildApiHistory(withEmpty, 'cuanto es');
    expect(h.every(m => m.content.trim().length > 0)).toBe(true);
    // El contexto de 4 × 4 sobrevive
    expect(h[0].content).toBe('cuanto es 4 × 4');
  });

  it('tolera chat vacío o indefinido', () => {
    expect(buildApiHistory(undefined, 'hola')).toEqual([{ role: 'user', content: 'hola' }]);
    expect(buildApiHistory([], 'hola')).toEqual([{ role: 'user', content: 'hola' }]);
  });
});

describe('trimHistory — ventana de contexto', () => {
  it('conserva los mensajes MÁS RECIENTES al exceder el máximo', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `msg-${i}`,
    }));
    const t = trimHistory(many);
    expect(t).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(t[t.length - 1].content).toBe('msg-59');
  });

  it('recorta por tamaño cuando un mensaje es enorme', () => {
    const huge = [
      { role: 'user' as const, content: 'x'.repeat(50_000) },
      { role: 'assistant' as const, content: 'ok' },
      { role: 'user' as const, content: 'sigue' },
    ];
    const t = trimHistory(huge, 40, 10_000);
    expect(t.some(m => m.content.length === 50_000)).toBe(false);
    expect(t[t.length - 1].content).toBe('sigue');
  });

  it('nunca vacía el historial por completo', () => {
    const one = [{ role: 'user' as const, content: 'y'.repeat(99_999) }];
    expect(trimHistory(one, 40, 100)).toHaveLength(1);
  });
});
