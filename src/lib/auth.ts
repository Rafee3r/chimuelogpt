/* ─────────── Clave familiar y época de sesión ───────────

   Por qué esto vive junto y no suelto en page.tsx: cambiar la clave NO
   cerraba la sesión de nadie.

   El flag de sesión guardaba el texto literal "true", y al cargar la app
   se aceptaba cualquier "true" guardado. Verificado en el historial de
   git: TODAS las versiones anteriores escribieron exactamente ese valor.
   Resultado: quien había entrado alguna vez seguía adentro para siempre,
   con la clave vieja o sin saber ninguna.

   Ahora se guarda la ÉPOCA de sesión y se compara exacto. Subir
   EPOCA_SESION echa a todos los dispositivos de una — incluidos los que
   entraron con versiones antiguas, porque su "true" ya no coincide con
   nada.

   👉 Para cerrar la sesión de todos en el futuro: sube el número de
      EPOCA_SESION. Eso basta; no hay que tocar nada más.

   Nota honesta sobre el alcance: esta reja vive en el navegador. Sirve
   para que la app sea de la familia y no de cualquiera que tenga el
   link, pero no es seguridad de verdad: las rutas de la API responden
   sin clave. Para eso haría falta validar en el servidor.
*/

export const CLAVE_FAMILIAR = 'chichimu';

/** Súbela para cerrar la sesión de todos los dispositivos. */
export const EPOCA_SESION = 'v2';

/** Dónde se guarda la sesión en el navegador. */
export const AUTH_KEY = 'chimuelo_auth';

/* Claves que estuvieron en uso. Solo sirven para responder "la clave
   cambió" en vez de "clave incorrecta": si a la abuela le decimos que se
   equivocó, va a seguir intentando la misma; si le decimos que cambió,
   la pide. */
export const CLAVES_ANTIGUAS = ['chimuelo', 'chimuelo26'];

export type ResultadoLogin = 'ok' | 'old' | 'wrong';

export function verificarClave(entrada: string): ResultadoLogin {
  const val = (entrada || '').toLowerCase().trim();
  if (val === CLAVE_FAMILIAR) return 'ok';
  if (CLAVES_ANTIGUAS.includes(val)) return 'old';
  return 'wrong';
}

/**
 * ¿La sesión guardada sigue siendo válida?
 * Comparación EXACTA contra la época actual: cualquier otra cosa
 * —incluido el "true" que escribieron todas las versiones viejas— se
 * considera sesión vencida.
 */
export function sesionVigente(guardado: string | null): boolean {
  return guardado === EPOCA_SESION;
}
