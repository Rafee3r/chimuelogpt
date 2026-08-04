/* ─────────── Errores de API en lenguaje humano ───────────
   Antes se mostraba al usuario el JSON crudo del proveedor:

     (Error de conexión: DeepSeek 503: {"error":{"message":"Service is
     too busy. We advise users to temporarily switch to alternative LLM
     API service providers.","type":"service_unavailable_error","pa…

   Eso no le sirve a nadie: no dice qué hacer y asusta. Aquí se traduce a
   una frase corta, honesta y accionable.
*/

export type FriendlyError = {
  message: string;
  /** true si reintentar tiene sentido (saturación, red, límite temporal) */
  retryable: boolean;
};

/** ¿Vale la pena reintentar este status? */
export function isRetryableStatus(status: number): boolean {
  // 429 = límite de tasa, 5xx = problema del proveedor. Ambos suelen pasar solos.
  return status === 429 || (status >= 500 && status <= 599);
}

/**
 * Convierte un error de proveedor en algo que una familia pueda entender.
 * No inventa causas: si no reconoce el error, lo dice sin adornos.
 */
export function friendlyApiError(status: number, rawBody?: string): FriendlyError {
  const body = (rawBody || '').toLowerCase();

  if (status === 429 || body.includes('rate limit')) {
    return { message: 'Hay mucha demanda ahora mismo. Espera unos segundos y vuelve a intentar.', retryable: true };
  }
  if (status === 503 || body.includes('too busy') || body.includes('service_unavailable')) {
    return { message: 'El servicio está saturado en este momento. Intenta de nuevo en un ratito.', retryable: true };
  }
  if (status === 504 || body.includes('timeout') || body.includes('timed out')) {
    return { message: 'La respuesta tardó demasiado. Prueba con el modo Rápido o vuelve a intentar.', retryable: true };
  }
  if (status === 401 || status === 403 || body.includes('authentication') || body.includes('invalid api key')) {
    // Esto es configuración, no algo que el usuario pueda resolver reintentando
    return { message: 'Hay un problema de configuración con el servicio. Avísale a Rafael.', retryable: false };
  }
  if (status === 402 || body.includes('insufficient balance') || body.includes('quota')) {
    return { message: 'Se acabó el saldo del servicio de IA. Avísale a Rafael para recargarlo.', retryable: false };
  }
  if (status === 400 || body.includes('invalid_request')) {
    return { message: 'No pude procesar ese mensaje. Prueba a escribirlo de otra forma.', retryable: false };
  }
  if (status >= 500) {
    return { message: 'El servicio de IA tuvo un problema. Intenta de nuevo en un momento.', retryable: true };
  }
  return { message: 'No pude completar la respuesta. Intenta de nuevo.', retryable: false };
}

/** Espera con backoff exponencial suave: 1s, 2s, 4s… */
export function backoffDelay(attempt: number, baseMs = 1000): number {
  return baseMs * Math.pow(2, attempt);
}
