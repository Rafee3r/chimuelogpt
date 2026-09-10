/* ─────────── IDs de modelo DeepSeek ───────────
   Los valores de localStorage / UI (`deepseek-v4-flash`, `deepseek-v4-pro`)
   se quedan para no romper preferencias guardadas. Estos son los nombres
   que hay que mandar a api.deepseek.com.
*/

/** DeepSeek-V4.1-Flash. Visión nativa incluida. */
export const DEEPSEEK_FLASH = 'deepseek-flash';

/** DeepSeek-V4-Pro (se retira el 14 sep 2026). */
export const DEEPSEEK_PRO = 'deepseek-v4-pro';

/** Preferencia de UI / localStorage para el modo rápido. */
export const CLIENT_MODEL_FLASH = 'deepseek-v4-flash';

/** Preferencia de UI / localStorage para el modo Pro. */
export const CLIENT_MODEL_PRO = 'deepseek-v4-pro';

export function resolveDeepSeekModel(
  clientModel?: string,
  thinkingLevel?: string,
): string {
  if (clientModel === CLIENT_MODEL_PRO || thinkingLevel === 'extended') {
    return DEEPSEEK_PRO;
  }
  return DEEPSEEK_FLASH;
}
