/* ─────────── IDs de modelo DeepSeek / OpenAI ───────────
   Modelos disponibles:
   - Flash (DeepSeek-V4.1-Flash): predeterminado rápido e inteligente.
   - Sin censura (ChatGPT 4o-mini): modelo directo sin filtros.
*/

/** DeepSeek-V4.1-Flash. Visión nativa incluida. */
export const DEEPSEEK_FLASH = 'deepseek-flash';

/** DeepSeek-V4-Pro (retirado; redirige a Flash para compatibilidad). */
export const DEEPSEEK_PRO = 'deepseek-flash';

/** Preferencia de UI / localStorage para el modo rápido. */
export const CLIENT_MODEL_FLASH = 'deepseek-v4-flash';

/** Preferencia histórica de UI / localStorage para el modo Pro. */
export const CLIENT_MODEL_PRO = 'deepseek-v4-pro';

/** OpenAI GPT-4o-mini para el modo Sin censura. */
export const OPENAI_GPT_4O_MINI = 'gpt-4o-mini';

/** Preferencia de UI / localStorage para el modo Sin censura. */
export const CLIENT_MODEL_UNCENSORED = 'chatgpt-4o-mini';

export function isUncensoredModel(model?: string): boolean {
  return model === CLIENT_MODEL_UNCENSORED || model === 'gpt-4o-mini' || model === 'sin-censura';
}

export function resolveDeepSeekModel(
  _clientModel?: string,
  _thinkingLevel?: string,
): string {
  return DEEPSEEK_FLASH;
}
