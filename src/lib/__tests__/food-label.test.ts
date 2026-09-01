import { describe, it, expect, beforeEach } from 'vitest';
import {
  parsearAnalisis, parsearQuimicos, extraerJson, categoriaNota,
  cargarHistorial, guardarEnHistorial, alternarFavorito, borrarDelHistorial,
  HISTORIAL_KEY, type ItemHistorial,
} from '../food-label';

/* Storage falso para no depender del navegador */
function fakeStore() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

const respuestaModelo = JSON.stringify({
  producto: 'Granola Frutilla y Plátano',
  marca: 'Seven Sundays',
  notaIngredientes: 100,
  veredicto: 'Excelente',
  analisis: 'Las frutillas y plátanos hacen todo el trabajo de endulzar.',
  puntos: [
    { etiqueta: 'Aceites de semilla', valor: 'Ninguno', nivel: 'bueno' },
    { etiqueta: 'Procesamiento', valor: 'Bajo', nivel: 'bueno' },
  ],
  ingredientes: [
    { nombre: 'Almendras' },
    { nombre: 'Aceite de coco', destacado: 'bueno', nota: 'Grasa estable' },
  ],
  sellos: ['alto en azúcares'],
});

describe('parsearAnalisis', () => {
  it('convierte la respuesta del modelo en algo renderizable', () => {
    const a = parsearAnalisis(respuestaModelo)!;
    expect(a.producto).toBe('Granola Frutilla y Plátano');
    expect(a.marca).toBe('Seven Sundays');
    expect(a.notaIngredientes).toBe(100);
    expect(a.puntos).toHaveLength(2);
    expect(a.ingredientes[1]).toEqual({
      nombre: 'Aceite de coco', destacado: 'bueno', nota: 'Grasa estable',
    });
  });

  it('normaliza los sellos chilenos a mayúsculas', () => {
    expect(parsearAnalisis(respuestaModelo)!.sellos).toEqual(['ALTO EN AZÚCARES']);
  });

  it('acepta ingredientes como texto simple', () => {
    const raw = JSON.stringify({ producto: 'X', analisis: 'y', ingredientes: ['Sal', 'Agua'] });
    expect(parsearAnalisis(raw)!.ingredientes).toEqual([
      { nombre: 'Sal', destacado: null },
      { nombre: 'Agua', destacado: null },
    ]);
  });

  it('acota las notas fuera de rango en vez de mostrar basura', () => {
    expect(parsearAnalisis(JSON.stringify({ producto: 'X', analisis: 'y', notaIngredientes: 250 }))!.notaIngredientes).toBe(100);
    expect(parsearAnalisis(JSON.stringify({ producto: 'X', analisis: 'y', notaIngredientes: -30 }))!.notaIngredientes).toBe(0);
  });

  it('ignora una nota nutricional aunque el modelo la mande', () => {
    const a = parsearAnalisis(JSON.stringify({
      producto: 'X', analisis: 'y', notaIngredientes: 20, notaNutricional: 90,
    }))!;
    expect(a.notaIngredientes).toBe(20);
    expect('notaNutricional' in a).toBe(false);
  });

  it('corrige un nivel inventado por el modelo', () => {
    const raw = JSON.stringify({
      producto: 'X', analisis: 'y',
      puntos: [{ etiqueta: 'Azúcar', valor: 'Alto', nivel: 'catastrofico' }],
    });
    expect(parsearAnalisis(raw)!.puntos[0].nivel).toBe('medio');
  });

  it('devuelve null si no hay nada aprovechable', () => {
    expect(parsearAnalisis('no entendí la foto')).toBeNull();
    expect(parsearAnalisis('')).toBeNull();
    expect(parsearAnalisis('{}')).toBeNull();
  });

  it('no rompe si faltan campos opcionales', () => {
    const a = parsearAnalisis(JSON.stringify({ producto: 'Pan', analisis: 'simple' }))!;
    expect(a.puntos).toEqual([]);
    expect(a.ingredientes).toEqual([]);
    expect(a.sellos).toEqual([]);
    expect(a.matiz).toBeNull();
  });
});

describe('extraerJson', () => {
  it('tolera el JSON envuelto en fences de markdown', () => {
    const raw = '```json\n{"producto":"Leche","analisis":"ok"}\n```';
    expect(extraerJson(raw).producto).toBe('Leche');
  });

  it('encuentra el objeto aunque venga con texto alrededor', () => {
    const raw = 'Claro, aquí tienes:\n{"producto":"Leche","analisis":"ok"}\n¡Espero que sirva!';
    expect(extraerJson(raw).producto).toBe('Leche');
  });

  it('devuelve null ante texto sin JSON', () => {
    expect(extraerJson('hola')).toBeNull();
  });
});

describe('parsearQuimicos', () => {
  const respuesta = JSON.stringify({
    quimicos: [
      {
        nombre: 'Jarabe de maíz de alta fructosa',
        queEs: 'Un azúcar líquido hecho de maíz.',
        porQue: 'El cuerpo lo procesa casi entero en el hígado.',
        gravedad: 'malo',
      },
      { nombre: 'Lecitina de soya', queEs: 'Un emulsionante.', porQue: 'Bastante inofensivo.', gravedad: 'medio' },
    ],
  });

  it('convierte la respuesta en una lista renderizable', () => {
    const q = parsearQuimicos(respuesta);
    expect(q).toHaveLength(2);
    expect(q[0].nombre).toBe('Jarabe de maíz de alta fructosa');
    expect(q[0].gravedad).toBe('malo');
    expect(q[1].gravedad).toBe('medio');
  });

  it('acepta el array pelado, sin la llave quimicos', () => {
    const raw = JSON.stringify([{ nombre: 'Colorante caramelo', queEs: 'Un tinte.', gravedad: 'malo' }]);
    expect(parsearQuimicos(raw)[0].nombre).toBe('Colorante caramelo');
  });

  it('corrige una gravedad inventada por el modelo', () => {
    const raw = JSON.stringify({ quimicos: [{ nombre: 'X', queEs: 'y', gravedad: 'letal' }] });
    expect(parsearQuimicos(raw)[0].gravedad).toBe('medio');
  });

  it('descarta entradas sin nombre o sin contenido', () => {
    const raw = JSON.stringify({ quimicos: [
      { nombre: '', queEs: 'sin nombre' },
      { nombre: 'Solo nombre' },
      { nombre: 'Válido', porQue: 'una razón' },
    ]});
    expect(parsearQuimicos(raw).map(q => q.nombre)).toEqual(['Válido']);
  });

  it('devuelve [] ante basura: la sección es complementaria y no debe romper la tarjeta', () => {
    expect(parsearQuimicos('no es json')).toEqual([]);
    expect(parsearQuimicos('')).toEqual([]);
    expect(parsearQuimicos('{}')).toEqual([]);
    expect(parsearQuimicos(JSON.stringify({ quimicos: 'no soy lista' }))).toEqual([]);
  });
});

describe('categoriaNota', () => {
  it('clasifica en los tres tramos', () => {
    expect(categoriaNota(90).texto).toBe('Excelente');
    expect(categoriaNota(60).texto).toBe('Aceptable');
    expect(categoriaNota(20).texto).toBe('Evitar');
    expect(categoriaNota(20).nivel).toBe('malo');
  });
});

describe('historial', () => {
  let st: ReturnType<typeof fakeStore>;
  const item = (id: string, favorito = false): ItemHistorial => ({
    id, fecha: Date.now(), favorito,
    producto: `Producto ${id}`, notaIngredientes: 50,
    veredicto: 'Aceptable', analisis: '', puntos: [], ingredientes: [], sellos: [],
  });

  beforeEach(() => { st = fakeStore(); });

  it('guarda y recupera', () => {
    guardarEnHistorial(item('a'), st);
    expect(cargarHistorial(st)).toHaveLength(1);
  });

  it('pone lo más reciente primero y no duplica', () => {
    guardarEnHistorial(item('a'), st);
    guardarEnHistorial(item('b'), st);
    guardarEnHistorial(item('a'), st);   // re-analiza el mismo producto
    const h = cargarHistorial(st);
    expect(h).toHaveLength(2);
    expect(h[0].id).toBe('a');
  });

  it('alterna favorito', () => {
    guardarEnHistorial(item('a'), st);
    expect(alternarFavorito('a', st)[0].favorito).toBe(true);
    expect(alternarFavorito('a', st)[0].favorito).toBe(false);
  });

  it('borra un elemento', () => {
    guardarEnHistorial(item('a'), st);
    guardarEnHistorial(item('b'), st);
    expect(borrarDelHistorial('a', st).map(i => i.id)).toEqual(['b']);
  });

  it('los favoritos sobreviven al recorte por límite', () => {
    guardarEnHistorial(item('fav', true), st);
    for (let i = 0; i < 120; i++) guardarEnHistorial(item(`n${i}`), st);
    const h = cargarHistorial(st);
    expect(h.length).toBeLessThanOrEqual(100);
    expect(h.some(i => i.id === 'fav')).toBe(true);
  });

  it('tolera datos corruptos en localStorage', () => {
    st.setItem(HISTORIAL_KEY, 'esto no es json');
    expect(cargarHistorial(st)).toEqual([]);
  });
});
