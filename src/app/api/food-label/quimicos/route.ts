import { friendlyApiError, isRetryableStatus, backoffDelay } from '../../../../lib/api-errors';

export const maxDuration = 60;

/* ─────────── Por qué son malos los aditivos de este producto ───────────
   Va SEPARADO del análisis de la foto y se pide después, por dos razones:

   1. Tiempo. El análisis con visión ya tarda ~18s de mediana. Meter aquí
      las explicaciones lo alargaba aún más y acercaba el corte de 60s de
      Vercel. Así el usuario ve su nota y sus ingredientes primero, y la
      explicación llega mientras ya está leyendo.

   2. Costo. Esto es texto contra texto: recibe nombres de ingredientes y
      devuelve texto. No necesita volver a mirar la imagen, así que corre
      en flash —mucho más barato y rápido que el modelo de visión— y solo
      se llama cuando de verdad hay algo marcado como problemático.
*/
const MODELO = 'deepseek-v4-flash';

const SYSTEM_PROMPT = `Eres el explicador de aditivos de Chimuelo. Te llega la lista de ingredientes que ya fueron marcados como problemáticos en un producto, y explicas qué es cada uno y por qué conviene evitarlo.

A QUIÉN LE HABLAS:
A alguien sin nada de química ni nutrición: puede ser un cabro de 15 años o una señora de 70. Si usas un término técnico, explícalo en la misma frase. Español chileno natural, sin markdown, sin emojis.

CÓMO ESCRIBIR CADA UNO:
- "queEs": UNA frase. Qué es y de dónde sale. Ejemplo: "Un azúcar líquido hecho de maíz, más barato que el azúcar común y mucho más dulce."
- "porQue": UNA o DOS frases. Qué le hace al cuerpo, o por qué la industria lo usa. Concreto y directo.

HONESTIDAD (esto importa más que sonar alarmante):
- No des diagnósticos ni consejos médicos.
- No digas que algo "causa" una enfermedad salvo que haya consenso claro. Si la evidencia es parcial, di "se asocia a" o "hay estudios que lo relacionan con".
- Si un ingrediente es discutido y no hay acuerdo científico, dilo en vez de exagerar.
- Nada de miedo inventado: si algo es más bien inofensivo y solo importa en exceso, ponle gravedad "medio" y explícalo así.

"gravedad" solo acepta:
- "malo": hay acuerdo amplio en que conviene evitarlo.
- "medio": está en discusión, o solo importa si se consume mucho.

Responde ÚNICAMENTE con este JSON, sin texto alrededor ni bloques de código:
{
  "quimicos": [
    {
      "nombre": "Jarabe de maíz de alta fructosa",
      "queEs": "Un azúcar líquido hecho de maíz, más barato que el azúcar común y mucho más dulce.",
      "porQue": "El cuerpo lo procesa casi entero en el hígado y no avisa que estás lleno, así que es fácil pasarse sin darte cuenta. Se asocia al hígado graso y al aumento de peso.",
      "gravedad": "malo"
    }
  ]
}`;

export async function POST(req: Request) {
  try {
    const { producto = '', ingredientes = [] } = await req.json();
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    if (!deepseekKey) {
      return Response.json({ error: 'El servicio no está configurado. Avísale a Rafael.' }, { status: 500 });
    }

    /* Sin ingredientes marcados no hay nada que explicar. El cliente ya
       evita llamar en ese caso; esto es el cinturón por si acaso. */
    const nombres = (Array.isArray(ingredientes) ? ingredientes : [])
      .map((i: any) => (typeof i === 'string' ? i : i?.nombre))
      .filter((n: any) => typeof n === 'string' && n.trim())
      .slice(0, 12);

    if (nombres.length === 0) {
      return Response.json({ raw: JSON.stringify({ quimicos: [] }) });
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Producto: ${producto || 'sin nombre'}\n\nIngredientes marcados como problemáticos:\n${nombres.map((n: string) => `- ${n}`).join('\n')}\n\nExplica cada uno según tus reglas.`,
      },
    ];

    const deadline = Date.now() + 45_000;
    /* Es una llamada de texto y corta: ~8s medidos. Un reintento necesita
       bastante menos margen que el análisis con visión. */
    const MINIMO_PARA_INTENTAR = 12_000;

    let lastStatus = 0;
    let lastBody = '';

    for (let intento = 0; intento <= 2; intento++) {
      const restante = deadline - Date.now();
      if (restante < MINIMO_PARA_INTENTAR) break;

      try {
        const res = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${deepseekKey}` },
          body: JSON.stringify({
            model: MODELO,
            messages,
            response_format: { type: 'json_object' },
            /* Mismo aprendizaje que en el análisis: el default de la API es
               'high' y aquí no hace falta razonar, solo explicar bien. */
            reasoning_effort: 'low',
            /* Cuenta razonamiento + respuesta juntos: generoso a propósito
               para no cortar la explicación a media frase. */
            max_tokens: 6000,
            stream: false,
          }),
          signal: AbortSignal.timeout(restante),
        });

        if (res.ok) {
          const data = await res.json();
          return Response.json({ raw: data.choices?.[0]?.message?.content || '' });
        }

        lastStatus = res.status;
        lastBody = await res.text().catch(() => '');
        if (!isRetryableStatus(res.status) || intento === 2) break;

        const espera = Math.min(backoffDelay(intento), Math.max(0, deadline - Date.now() - MINIMO_PARA_INTENTAR));
        if (espera <= 0) break;
        console.warn(`quimicos: DeepSeek ${res.status}, reintento ${intento + 1}/2`);
        await new Promise(r => setTimeout(r, espera));
      } catch (e: any) {
        if (e?.name === 'AbortError' || e?.name === 'TimeoutError') { lastStatus = 504; break; }
        lastStatus = 0;
        lastBody = String(e?.message || e);
        if (intento === 2) break;
        await new Promise(r => setTimeout(r, backoffDelay(intento)));
      }
    }

    /* Esta sección es complementaria: si falla, el análisis principal sigue
       en pantalla y solo se pierde el detalle. El mensaje lo refleja. */
    const amigable = lastStatus && lastStatus !== 504
      ? friendlyApiError(lastStatus, lastBody)
      : { message: 'No pude generar el detalle de los aditivos. El análisis de arriba sigue siendo válido.' };
    console.error('quimicos falló:', lastStatus, lastBody.slice(0, 200));
    return Response.json({ error: amigable.message }, { status: 503 });

  } catch {
    return Response.json({ error: 'No pude procesar la solicitud.' }, { status: 400 });
  }
}
