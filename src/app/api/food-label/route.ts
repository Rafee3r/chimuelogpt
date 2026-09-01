import { VISION_MODEL, buildVisionMessages, filterUsableImages } from '../../../lib/vision-payload';
import { friendlyApiError, isRetryableStatus, backoffDelay } from '../../../lib/api-errors';

export const maxDuration = 60;

/* Postura marcada, como pidió el usuario: penaliza fuerte ultraprocesados,
   aceites de semilla refinados y azúcares añadidos, con veredictos directos.
   El campo `matiz` existe para que, cuando algo esté genuinamente en debate,
   el modelo lo diga en una línea sin diluir el veredicto. */
const SYSTEM_PROMPT = `Eres el analizador de etiquetas de Chimuelo. Te llega la foto de un producto (ingredientes y/o tabla nutricional) y devuelves un análisis directo y sin rodeos.

FILOSOFÍA (aplícala con carácter):
- La comida real gana. Mientras más corta y reconocible la lista de ingredientes, mejor.
- Penaliza DURO: aceites de semilla refinados (maravilla/girasol, canola, soya, maíz, cártamo, salvado de arroz), azúcares añadidos (jarabe de maíz alta fructosa, maltodextrina, dextrosa), saborizantes artificiales, colorantes, conservantes sintéticos, edulcorantes artificiales y "sabor natural" sin especificar.
- Premia: ingredientes enteros, grasas estables (coco, oliva, palta, mantequilla), fermentados, fibra real, sin aditivos.
- Sé claro y directo en el veredicto. Nada de tibiezas tipo "todo con moderación".

DOS NOTAS SEPARADAS (0-100), nunca las mezcles:
- notaIngredientes: qué tan real es la comida. Ultraprocesado con lista larga = bajo. Ingredientes enteros = alto.
- notaNutricional: lo que dice la tabla (azúcar, sodio, grasas saturadas, fibra, proteína).
Un producto puede tener 100 en ingredientes y 40 en nutrición (ej: papas fritas en aceite de oliva): eso es correcto y debe verse así.

HONESTIDAD (importante):
- Si en la foto NO se ve la tabla nutricional, pon notaNutricional en 0 y agrega un punto con etiqueta "Tabla nutricional" y valor "No visible en la foto". NO inventes cifras.
- Si no logras leer los ingredientes, dilo en "analisis" y deja las listas vacías.
- Usa "matiz" SOLO cuando penalices algo que está genuinamente en discusión científica (ej. aceites de semilla). Una frase corta y honesta. Si no aplica, null.

SELLOS CHILENOS: si ves los octágonos negros ("ALTO EN AZÚCARES", "ALTO EN SODIO", "ALTO EN GRASAS SATURADAS", "ALTO EN CALORÍAS"), inclúyelos en "sellos".

Responde ÚNICAMENTE con este JSON, sin texto alrededor ni bloques de código:
{
  "producto": "nombre del producto",
  "marca": "marca si se ve, si no omite",
  "notaIngredientes": 0-100,
  "notaNutricional": 0-100,
  "veredicto": "Excelente" | "Bueno" | "Aceptable" | "Regular" | "Evitar",
  "analisis": "2-4 frases directas sobre lo que importa de este producto. Español chileno natural, sin markdown.",
  "puntos": [
    {"etiqueta": "Aceites de semilla", "valor": "Ninguno", "nivel": "bueno"},
    {"etiqueta": "Procesamiento", "valor": "Bajo", "nivel": "bueno"},
    {"etiqueta": "Azúcar añadida", "valor": "12g por porción", "nivel": "malo"}
  ],
  "ingredientes": [
    {"nombre": "Almendras"},
    {"nombre": "Aceite de maravilla", "destacado": "malo", "nota": "Aceite de semilla refinado"}
  ],
  "sellos": ["ALTO EN AZÚCARES"],
  "matiz": null
}
"nivel" solo acepta: "bueno", "medio", "malo".`;

export async function POST(req: Request) {
  try {
    const { imagesBase64 = [], imageBase64 } = await req.json();
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    if (!deepseekKey) {
      return Response.json({ error: 'El servicio no está configurado. Avísale a Rafael.' }, { status: 500 });
    }

    const entrada = imagesBase64.length > 0 ? imagesBase64 : (imageBase64 ? [imageBase64] : []);
    const { usable } = filterUsableImages(entrada);
    if (usable.length === 0) {
      return Response.json({ error: 'No pude leer esa foto. Prueba con otra imagen del producto.' }, { status: 400 });
    }

    const messages = buildVisionMessages(
      SYSTEM_PROMPT,
      [],
      'Analiza este producto según tus reglas y responde solo con el JSON.',
      usable.slice(0, 3)   // etiqueta + tabla nutricional + reverso basta
    );

    /* Reintento ante saturación: los 503/429 de DeepSeek son transitorios.
       Deadline por debajo del límite de la función para no morir por timeout. */
    const deadline = Date.now() + 50_000;

    /* Un análisis medido en produccion tarda ~18s de mediana y hasta ~32s en
       el peor caso observado. Arrancar un intento con menos de esto en el
       reloj es tiempo quemado: no alcanza a terminar y encima convierte un
       "servicio saturado" (claro y accionable) en un "tardó demasiado"
       (confuso). Mejor cortar y devolver el error real. */
    const MINIMO_PARA_INTENTAR = 20_000;

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
            model: VISION_MODEL,
            messages,
            response_format: { type: 'json_object' },
            /* ⚠️ Sin esto la API razona por defecto, y eso costaba ~25s con una
               etiqueta PLANA, nítida y de alto contraste. Una foto real de
               celular (fondo, ángulo, brillo, letra chica) se pasaba de los
               60s de Vercel y el usuario solo veía "tardó demasiado".
               Leer una etiqueta es OCR + criterio, no razonamiento profundo:
               'low' alcanza de sobra. Mismo aprendizaje que en /api/chat. */
            reasoning_effort: 'low',
            /* ⚠️ TRAMPA: max_tokens cuenta razonamiento + respuesta JUNTOS.
               Con 1500 el razonamiento se comía el presupuesto y el JSON
               llegaba cortado a media frase (y a veces vacío), que para el
               usuario se ve peor que el timeout: "no logré leer la etiqueta"
               con una foto perfecta. El JSON completo ronda los 600 tokens,
               así que 8000 es un techo que jamás corta una respuesta real
               y solo ataja un caso patológico. Quien lo baje, que mida. */
            max_tokens: 8000,
            stream: false,
          }),
          signal: AbortSignal.timeout(restante),
        });

        if (res.ok) {
          const data = await res.json();
          const contenido = data.choices?.[0]?.message?.content || '';
          return Response.json({ raw: contenido });
        }

        lastStatus = res.status;
        lastBody = await res.text().catch(() => '');
        if (!isRetryableStatus(res.status) || intento === 2) break;

        const espera = Math.min(backoffDelay(intento), Math.max(0, deadline - Date.now() - MINIMO_PARA_INTENTAR));
        if (espera <= 0) break;
        console.warn(`food-label: DeepSeek ${res.status}, reintento ${intento + 1}/2`);
        await new Promise(r => setTimeout(r, espera));
      } catch (e: any) {
        if (e?.name === 'AbortError' || e?.name === 'TimeoutError') {
          lastStatus = 504;
          break;
        }
        lastStatus = 0;
        lastBody = String(e?.message || e);
        if (intento === 2) break;
        await new Promise(r => setTimeout(r, backoffDelay(intento)));
      }
    }

    /* El texto genérico de timeout habla de "modo Rápido", que aquí no
       existe: en Ingredientes lo único accionable es la foto. */
    const amigable =
      lastStatus === 504
        ? { message: 'La foto tardó demasiado en analizarse. Prueba de nuevo acercando la cámara a la etiqueta, con buena luz y sin reflejos.' }
        : lastStatus
        ? friendlyApiError(lastStatus, lastBody)
        : { message: 'No pude conectar para analizar la foto. Intenta de nuevo.' };
    console.error('food-label falló:', lastStatus, lastBody.slice(0, 200));
    return Response.json({ error: amigable.message }, { status: lastStatus === 504 ? 504 : 503 });

  } catch {
    return Response.json({ error: 'No pude procesar la solicitud.' }, { status: 400 });
  }
}
