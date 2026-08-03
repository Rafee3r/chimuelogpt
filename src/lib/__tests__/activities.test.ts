import { describe, it, expect } from 'vitest';
import {
  startActivity, finishActivity, settlePendingActivities,
  activityLabel, hasRunning, type ToolActivity,
} from '../activities';

describe('startActivity', () => {
  it('arranca en running con id único', () => {
    const a = startActivity('search', 'precio del dólar');
    expect(a.status).toBe('running');
    expect(a.kind).toBe('search');
    expect(a.detail).toBe('precio del dólar');
    const b = startActivity('search');
    expect(a.id).not.toBe(b.id);
  });
});

describe('activityLabel — lenguaje claro para la familia', () => {
  it('usa gerundio mientras corre e incluye el detalle', () => {
    const a = startActivity('read-doc', 'cv.pdf');
    expect(activityLabel(a)).toBe('Leyendo el documento: cv.pdf');
  });

  it('usa pasado al terminar y muestra el resultado', () => {
    const done: ToolActivity = { id: '1', kind: 'search', status: 'done', result: '3 fuentes' };
    expect(activityLabel(done)).toBe('Búsqueda web · 3 fuentes');
  });

  it('explica el fallo sin jerga técnica', () => {
    const err: ToolActivity = { id: '1', kind: 'read-url', status: 'error' };
    expect(activityLabel(err)).toBe('No pude abrir el enlace');
  });
});

describe('finishActivity', () => {
  it('cierra solo la actividad indicada y no muta el array', () => {
    const a = startActivity('search');
    const b = startActivity('image');
    const list = [a, b];
    const next = finishActivity(list, a.id, 'done', '3 fuentes');

    expect(next[0].status).toBe('done');
    expect(next[0].result).toBe('3 fuentes');
    expect(next[1].status).toBe('running');
    expect(list[0].status).toBe('running'); // original intacto
  });

  it('ignora ids inexistentes sin romper', () => {
    const list = [startActivity('calc')];
    expect(finishActivity(list, 'no-existe', 'done')).toHaveLength(1);
  });
});

describe('settlePendingActivities — nada queda girando para siempre', () => {
  it('marca como error lo que quedó running', () => {
    const list = [
      startActivity('search'),
      { id: 'x', kind: 'image', status: 'done' } as ToolActivity,
    ];
    const settled = settlePendingActivities(list);
    expect(settled[0].status).toBe('error');
    expect(settled[1].status).toBe('done'); // lo ya terminado no se toca
  });
});

describe('hasRunning', () => {
  it('detecta actividades en curso', () => {
    expect(hasRunning([startActivity('music')])).toBe(true);
    expect(hasRunning([{ id: '1', kind: 'calc', status: 'done' }])).toBe(false);
    expect(hasRunning(undefined)).toBe(false);
    expect(hasRunning([])).toBe(false);
  });
});
