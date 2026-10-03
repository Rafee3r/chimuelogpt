/* ─────────── IDs de modelo DeepSeek ───────────
   Solo queda Flash (DeepSeek-V4.1-Flash). Pro se retiró.
   resolveDeepSeekModel devuelve siempre DEEPSEEK_FLASH para
   no romper llamadas que aún manden valores viejos de localStorage.
*/

/** DeepSeek-V4.1-Flash. Visión nativa incluida. */
export const DEEPSEEK_FLASH = 'deepseek-flash';

/** DeepSeek-V4-Pro (retirado; redirige a Flash para compatibilidad). */
export const DEEPSEEK_PRO = 'deepseek-flash';

/** Preferencia de UI / localStorage para el modo rápido. */
export const CLIENT_MODEL_FLASH = 'deepseek-v4-flash';

/** Preferencia histórica de UI / localStorage para el modo Pro. */
export const CLIENT_MODEL_PRO = 'deepseek-v4-pro';

export function resolveDeepSeekModel(
  _clientModel?: string,
  _thinkingLevel?: string,
): string {
  return DEEPSEEK_FLASH;
}
