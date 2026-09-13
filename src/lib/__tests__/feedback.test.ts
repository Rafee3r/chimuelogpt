import { describe, it, expect } from 'vitest';
import { parsearFeedback, textoNotificacion } from '../feedback';

describe('parsearFeedback', () => {
  it('acepta un comentario normal', () => {
    const r = parsearFeedback({ type: 'comment', comment: 'Ingredientes no abre', nombre: 'Anita' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.type).toBe('comment');
      expect(r.data.nombre).toBe('Anita');
    }
  });

  it('rechaza un comentario vacío', () => {
    const r = parsearFeedback({ type: 'comment', comment: 'no' });
    expect(r.ok).toBe(false);
  });

  it('recorta textos largos', () => {
    const r = parsearFeedback({ type: 'comment', comment: 'hola mundo', nombre: 'x'.repeat(80) });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.nombre.length).toBe(40);
  });
});

describe('textoNotificacion', () => {
  it('arma un mensaje legible', () => {
    const t = textoNotificacion({
      type: 'dislike', comment: 'se inventó la receta', nombre: 'Rafa', contexto: 'hazme un pastel',
    });
    expect(t.title).toContain('gustó');
    expect(t.body).toContain('Rafa');
    expect(t.body).toContain('pastel');
  });
});
