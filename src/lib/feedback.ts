export const TIPOS_FEEDBACK = ['like', 'dislike', 'comment'] as const;
export type TipoFeedback = (typeof TIPOS_FEEDBACK)[number];

export type PayloadFeedback = {
  type: TipoFeedback;
  comment: string;
  nombre: string;
  contexto: string;
};

export function parsearFeedback(body: any): { ok: true; data: PayloadFeedback } | { ok: false; error: string } {
  const type = TIPOS_FEEDBACK.includes(body?.type) ? body.type : 'comment';
  const comment = String(body?.comment || '').trim().slice(0, 1200);
  const nombre = String(body?.nombre || '').trim().slice(0, 40);
  const contexto = String(body?.contexto || '').trim().slice(0, 400);

  if (type === 'comment' && comment.length < 3) {
    return { ok: false, error: 'Escribe un poco más para que Rafael entienda.' };
  }

  return { ok: true, data: { type, comment, nombre, contexto } };
}

export function textoNotificacion(data: PayloadFeedback): { title: string; body: string } {
  const title =
    data.type === 'like' ? '👍 Le gustó una respuesta'
    : data.type === 'dislike' ? '👎 No le gustó una respuesta'
    : '💬 Comentario para Rafael';

  const body = [
    data.nombre && `De: ${data.nombre}`,
    data.comment,
    data.contexto && `Contexto: ${data.contexto}`,
  ].filter(Boolean).join('\n');

  return { title, body: body || title };
}
