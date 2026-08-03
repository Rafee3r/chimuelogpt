/* ─────────── Actividades de herramientas ───────────
   Da visibilidad de lo que Chimuelo está haciendo mientras responde:
   "Leyendo el documento", "Buscando información actualizada", etc.

   Antes cada flujo tenía su propio loader suelto (o ninguno) y el usuario
   veía un silencio largo sin saber si la app estaba trabajando o colgada.
   Este módulo unifica el ciclo de vida: running → done | error.
*/

export type ActivityKind =
  | 'search'      // búsqueda web
  | 'read-doc'    // leer PDF/DOCX adjunto
  | 'read-url'    // leer una página enlazada
  | 'image'       // generar imagen
  | 'music'       // componer música
  | 'reminder'    // agendar recordatorio
  | 'calc'        // cálculo exacto
  | 'artifact';   // construir documento visual

export type ActivityStatus = 'running' | 'done' | 'error';

export type ToolActivity = {
  id: string;
  kind: ActivityKind;
  status: ActivityStatus;
  /** Dato concreto: nombre del archivo, término buscado, etc. */
  detail?: string;
  /** Resumen corto al terminar: "3 fuentes", "2 páginas" */
  result?: string;
};

/* Etiquetas por estado. En gerundio mientras corre (transmite progreso),
   en pasado al terminar (transmite que quedó hecho). */
const LABELS: Record<ActivityKind, { running: string; done: string; error: string }> = {
  search:   { running: 'Buscando información actualizada', done: 'Búsqueda web',        error: 'No pude buscar en internet' },
  'read-doc': { running: 'Leyendo el documento',           done: 'Documento leído',     error: 'No pude leer el documento' },
  'read-url': { running: 'Leyendo la página',              done: 'Página leída',        error: 'No pude abrir el enlace' },
  image:    { running: 'Creando la imagen',                done: 'Imagen creada',       error: 'No pude crear la imagen' },
  music:    { running: 'Componiendo la música',            done: 'Música compuesta',    error: 'No pude componer la música' },
  reminder: { running: 'Agendando el recordatorio',        done: 'Recordatorio agendado', error: 'No pude agendar' },
  calc:     { running: 'Calculando',                       done: 'Cálculo exacto',      error: 'No pude calcular' },
  artifact: { running: 'Preparando el documento',          done: 'Documento listo',     error: 'No pude generar el documento' },
};

export function activityLabel(a: ToolActivity): string {
  const base = LABELS[a.kind]?.[a.status] ?? a.kind;
  if (a.status === 'running') return a.detail ? `${base}: ${a.detail}` : base;
  if (a.status === 'done' && a.result) return `${base} · ${a.result}`;
  if (a.status === 'done' && a.detail) return `${base} · ${a.detail}`;
  return base;
}

export function startActivity(kind: ActivityKind, detail?: string): ToolActivity {
  return {
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    status: 'running',
    detail,
  };
}

/** Marca una actividad como terminada sin mutar el array original. */
export function finishActivity(
  list: ToolActivity[],
  id: string,
  status: 'done' | 'error',
  result?: string
): ToolActivity[] {
  return list.map(a => (a.id === id ? { ...a, status, ...(result ? { result } : {}) } : a));
}

/** Cierra las actividades que quedaron colgadas (stream abortado o error). */
export function settlePendingActivities(list: ToolActivity[]): ToolActivity[] {
  return list.map(a => (a.status === 'running' ? { ...a, status: 'error' as const } : a));
}

export function hasRunning(list: ToolActivity[] | undefined): boolean {
  return !!list?.some(a => a.status === 'running');
}
