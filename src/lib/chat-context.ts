/* ─────────── Construcción del historial que se envía a la IA ───────────
   Bug que resuelve: el historial se armaba desde el state `chats` capturado
   en el closure de handleSendMessage. Ese valor queda desactualizado (React
   no lo actualiza dentro de la misma ejecución), así que en chats nuevos o
   con mensajes seguidos la IA recibía CERO turnos previos y respondía cosas
   como "¿Cuánto es qué?" tras haber hablado de 4 × 4.

   La solución en page.tsx es leer de una ref siempre-fresca; aquí vive la
   lógica pura de armado y recorte, testeable sin React.
*/

import type { BaseMessage } from './types';

export type ApiMessage = { role: 'user' | 'assistant'; content: string };

/* Cuántos turnos previos mandamos. DeepSeek admite contextos grandes, pero
   mandar 200 mensajes es lento y caro; una ventana amplia conserva el hilo
   de una conversación familiar real sin desperdiciar tokens. */
export const MAX_HISTORY_MESSAGES = 40;

/* Presupuesto de caracteres del historial (~4 chars ≈ 1 token). Protege de
   un solo mensaje gigante (PDF pegado) que desplace todo lo demás. */
export const MAX_HISTORY_CHARS = 48_000;

/**
 * Arma el historial para la API a partir de los mensajes guardados del chat.
 *
 * @param messages      Mensajes del chat (fuente fresca, no del closure).
 * @param currentUserContent Texto final del turno actual (ya con documentos/
 *                      enlaces inyectados). Se agrega SIEMPRE al final.
 * @param excludeId     id del mensaje del usuario recién agregado al state.
 *                      Se excluye para no duplicarlo con currentUserContent,
 *                      sin importar si el state alcanzó a actualizarse.
 */
export function buildApiHistory(
  messages: BaseMessage[] | undefined,
  currentUserContent: string,
  excludeId?: string
): ApiMessage[] {
  const prior: ApiMessage[] = (messages || [])
    .filter(m => {
      if (!m || !m.role) return false;
      if (excludeId && m.id === excludeId) return false;
      // Un mensaje sin texto no aporta contexto y puede romper la alternancia
      return typeof m.content === 'string' && m.content.trim().length > 0;
    })
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const windowed = trimHistory(prior);
  windowed.push({ role: 'user', content: currentUserContent });
  return windowed;
}

/**
 * Recorta el historial por cantidad y por tamaño, conservando SIEMPRE lo más
 * reciente (que es lo que da continuidad a la conversación).
 */
export function trimHistory(
  history: ApiMessage[],
  maxMessages = MAX_HISTORY_MESSAGES,
  maxChars = MAX_HISTORY_CHARS
): ApiMessage[] {
  let result = history.length > maxMessages ? history.slice(-maxMessages) : [...history];

  // Recorta desde el principio hasta entrar en el presupuesto de caracteres
  let total = result.reduce((acc, m) => acc + m.content.length, 0);
  while (total > maxChars && result.length > 1) {
    const dropped = result.shift();
    total -= dropped ? dropped.content.length : 0;
  }
  return result;
}
