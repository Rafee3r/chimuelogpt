/* ─────────── Análisis de etiquetas de alimentos ───────────
   El usuario le saca una foto a los ingredientes y Chimuelo devuelve UNA
   nota: qué tan real es la comida (procesamiento, aceites de semilla,
   azúcares añadidos, aditivos).

   Antes había una segunda nota nutricional al lado. Se quitó a propósito:
   dos notas compiten entre sí y la nutricional amortiguaba a la de
   ingredientes. Un producto lleno de aditivos que sacaba 20 en ingredientes
   y 70 en nutrición se leía como "regular nomás", cuando el mensaje real
   era el de los aditivos. Una sola nota no deja dónde esconderse.

   El modelo responde en JSON. Aquí vive el parseo defensivo: si la respuesta
   viene incompleta o con basura, se normaliza en vez de romper la pantalla.
*/

export type NivelPunto = 'bueno' | 'medio' | 'malo';

export type PuntoAnalisis = {
  etiqueta: string;
  valor: string;
  nivel: NivelPunto;
};

export type IngredienteAnalizado = {
  nombre: string;
  /** Se resalta en la lista cuando destaca para bien o para mal. */
  destacado?: NivelPunto | null;
  /** Por qué se destacó (aparece al tocarlo). */
  nota?: string;
};

/** Explicación en lenguaje simple de un ingrediente problemático. */
export type QuimicoExplicado = {
  nombre: string;
  /** Qué es y de dónde sale, en una frase. */
  queEs: string;
  /** Por qué conviene evitarlo. */
  porQue: string;
  /** 'malo' si hay consenso; 'medio' si está en discusión o solo importa en exceso. */
  gravedad: NivelPunto;
};

export type AnalisisEtiqueta = {
  producto: string;
  marca?: string;
  notaIngredientes: number;   // 0-100
  veredicto: string;          // "Excelente", "Aceptable", "Evitar"…
  analisis: string;           // párrafo narrativo
  puntos: PuntoAnalisis[];
  ingredientes: IngredienteAnalizado[];
  sellos: string[];           // sellos chilenos: "ALTO EN AZÚCARES"…
  /** Solo cuando algo está genuinamente en debate científico. */
  matiz?: string | null;
};

export type ItemHistorial = AnalisisEtiqueta & {
  id: string;
  fecha: number;
  favorito?: boolean;
  imagen?: string;            // miniatura para reconocerlo en la lista
  /* Se guardan para no volver a pedirlos —y pagarlos— al reabrir el
     producto desde el historial. */
  quimicos?: QuimicoExplicado[];
};

const NIVELES: NivelPunto[] = ['bueno', 'medio', 'malo'];

function clampNota(n: unknown): number {
  const num = typeof n === 'number' ? n : parseInt(String(n ?? ''), 10);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function nivelValido(v: unknown): NivelPunto {
  return NIVELES.includes(v as NivelPunto) ? (v as NivelPunto) : 'medio';
}

/** Color/etiqueta según la nota. Usado por la UI y por el veredicto. */
export function categoriaNota(nota: number): { nivel: NivelPunto; texto: string } {
  if (nota >= 75) return { nivel: 'bueno', texto: 'Excelente' };
  if (nota >= 45) return { nivel: 'medio', texto: 'Aceptable' };
  return { nivel: 'malo', texto: 'Evitar' };
}

/**
 * Extrae el JSON de la respuesta del modelo, tolerando que venga envuelto en
 * ```json … ``` o con texto alrededor.
 */
export function extraerJson(raw: string): any | null {
  if (!raw || typeof raw !== 'string') return null;

  const sinFences = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(sinFences);
  } catch { /* seguimos intentando */ }

  // Busca el primer objeto balanceado dentro del texto
  const inicio = sinFences.indexOf('{');
  if (inicio === -1) return null;
  let profundidad = 0;
  for (let i = inicio; i < sinFences.length; i++) {
    if (sinFences[i] === '{') profundidad++;
    else if (sinFences[i] === '}') {
      profundidad--;
      if (profundidad === 0) {
        try { return JSON.parse(sinFences.slice(inicio, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

/**
 * Normaliza la respuesta del modelo a una estructura segura de renderizar.
 * Devuelve null solo si no hay NADA aprovechable, para que la UI pueda
 * ofrecer reintentar en vez de mostrar una pantalla rota.
 */
export function parsearAnalisis(raw: string): AnalisisEtiqueta | null {
  const data = extraerJson(raw);
  if (!data || typeof data !== 'object') return null;

  const producto = String(data.producto || data.nombre || '').trim();
  const analisis = String(data.analisis || data.resumen || '').trim();

  // Sin nombre ni análisis no hay nada que mostrar
  if (!producto && !analisis) return null;

  const notaIngredientes = clampNota(data.notaIngredientes);

  const puntos: PuntoAnalisis[] = Array.isArray(data.puntos)
    ? data.puntos
        .filter((p: any) => p && (p.etiqueta || p.label))
        .slice(0, 8)
        .map((p: any) => ({
          etiqueta: String(p.etiqueta || p.label).trim(),
          valor: String(p.valor ?? p.value ?? '').trim(),
          nivel: nivelValido(p.nivel ?? p.level),
        }))
    : [];

  const ingredientes: IngredienteAnalizado[] = Array.isArray(data.ingredientes)
    ? data.ingredientes
        .filter((i: any) => i && (typeof i === 'string' ? i.trim() : i.nombre))
        .slice(0, 60)
        .map((i: any) =>
          typeof i === 'string'
            ? { nombre: i.trim(), destacado: null }
            : {
                nombre: String(i.nombre).trim(),
                destacado: i.destacado ? nivelValido(i.destacado) : null,
                nota: i.nota ? String(i.nota).trim() : undefined,
              }
        )
    : [];

  const sellos: string[] = Array.isArray(data.sellos)
    ? data.sellos.map((s: any) => String(s).trim().toUpperCase()).filter(Boolean).slice(0, 6)
    : [];

  return {
    producto: producto || 'Producto sin nombre',
    marca: data.marca ? String(data.marca).trim() : undefined,
    notaIngredientes,
    veredicto: String(data.veredicto || categoriaNota(notaIngredientes).texto).trim(),
    analisis,
    puntos,
    ingredientes,
    sellos,
    matiz: data.matiz ? String(data.matiz).trim() : null,
  };
}

/**
 * Normaliza la explicación de los ingredientes problemáticos.
 * Devuelve [] ante cualquier basura: esta sección es complementaria y su
 * ausencia nunca debe romper la tarjeta ni ocultar el análisis principal.
 */
export function parsearQuimicos(raw: string): QuimicoExplicado[] {
  const data = extraerJson(raw);
  const lista = Array.isArray(data) ? data : data?.quimicos;
  if (!Array.isArray(lista)) return [];

  return lista
    .filter((q: any) => q && q.nombre && (q.queEs || q.porQue))
    .slice(0, 12)
    .map((q: any) => ({
      nombre: String(q.nombre).trim(),
      queEs: String(q.queEs ?? '').trim(),
      porQue: String(q.porQue ?? '').trim(),
      gravedad: nivelValido(q.gravedad),
    }));
}

/* ─────────── Historial (localStorage) ─────────── */

export const HISTORIAL_KEY = 'chimuelo_food_history';
const MAX_HISTORIAL = 100;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const store = (s?: StorageLike): StorageLike | null =>
  s || (typeof localStorage !== 'undefined' ? localStorage : null);

export function cargarHistorial(s?: StorageLike): ItemHistorial[] {
  const st = store(s);
  if (!st) return [];
  try {
    const raw = st.getItem(HISTORIAL_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(i => i && i.id) : [];
  } catch {
    return [];
  }
}

export function guardarEnHistorial(item: ItemHistorial, s?: StorageLike): ItemHistorial[] {
  const st = store(s);
  const actuales = cargarHistorial(s);
  // Los favoritos nunca se pierden por el recorte del máximo
  const siguientes = [item, ...actuales.filter(i => i.id !== item.id)];
  const favoritos = siguientes.filter(i => i.favorito);
  const resto = siguientes.filter(i => !i.favorito).slice(0, MAX_HISTORIAL - favoritos.length);
  const final = [...siguientes.filter(i => i.favorito || resto.includes(i))].slice(0, MAX_HISTORIAL);

  try { st?.setItem(HISTORIAL_KEY, JSON.stringify(final)); } catch { /* cuota llena */ }
  return final;
}

export function alternarFavorito(id: string, s?: StorageLike): ItemHistorial[] {
  const actuales = cargarHistorial(s).map(i =>
    i.id === id ? { ...i, favorito: !i.favorito } : i
  );
  try { store(s)?.setItem(HISTORIAL_KEY, JSON.stringify(actuales)); } catch {}
  return actuales;
}

export function borrarDelHistorial(id: string, s?: StorageLike): ItemHistorial[] {
  const actuales = cargarHistorial(s).filter(i => i.id !== id);
  try { store(s)?.setItem(HISTORIAL_KEY, JSON.stringify(actuales)); } catch {}
  return actuales;
}
