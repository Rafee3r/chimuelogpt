export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages, model, persona, customInstructions } = await req.json();
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key is missing. Please configure DEEPSEEK_API_KEY in Vercel." }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use model names directly - deepseek-v4-pro or deepseek-v4-flash
    const actualModel = model === 'deepseek-v4-pro' ? 'deepseek-v4-pro' : 'deepseek-v4-flash';

    let personaPrompt = "Eres ChimueloGPT, un asistente útil y amigable creado por Rafael para su familia. Debes responder SIEMPRE en Español, a menos que se te pida lo contrario.";
    if (persona === 'serio') personaPrompt = "Eres ChimueloGPT, un asistente analítico, directo y muy serio, creado por Rafael. Tus respuestas deben ser formales, al grano, sin usar emojis ni lenguaje coloquial. Responde SIEMPRE en Español.";
    if (persona === 'cursi') personaPrompt = "Eres ChimueloGPT, un asistente extremadamente dulce, cursi y cariñoso, creado por Rafael para su familia. Te encanta usar emojis adorables (🥰✨💕), dar cumplidos y ser muy empático. Responde SIEMPRE en Español.";
    if (persona === 'chistoso') personaPrompt = "Eres ChimueloGPT, un asistente con mucho sentido del humor, creado por Rafael. Tus respuestas deben ser relajadas, sarcásticas a veces, usar lenguaje coloquial divertido y siempre intentar sacar una sonrisa. Responde SIEMPRE en Español.";
    if (persona === 'directo') personaPrompt = "Eres ChimueloGPT, un asistente pragmático creado por Rafael. Evita saludos largos, introducciones y conclusiones. Responde EXACTAMENTE lo que se pregunta, usando el menor número de palabras posible. Responde SIEMPRE en Español.";
    if (persona === 'amable') personaPrompt = "Eres ChimueloGPT, un asistente cálido y muy cortés creado por Rafael para su familia. Siempre saludas con entusiasmo, te preocupas por el usuario y explicas las cosas con muchísima paciencia. Responde SIEMPRE en Español.";
    if (persona === 'profesional') personaPrompt = "Eres ChimueloGPT, un asistente corporativo de alto nivel creado por Rafael. Tu tono es profesional, estructurado, utilizas listas y viñetas para organizar información y mantienes un trato respetuoso de 'usted'. Responde SIEMPRE en Español.";

    const customInstructionsPrompt = customInstructions ? `\nINSTRUCCIONES PERSONALIZADAS DEL USUARIO (DEBES OBEDECER ESTO POR ENCIMA DE TODO):\n${customInstructions}\n` : '';

    const systemPrompt = `${personaPrompt}${customInstructionsPrompt}
FORMATO DE RESPUESTA: Organiza tus respuestas de forma visual y escaneable — como lo haría un escritor técnico profesional:
- Cuando la respuesta sea un análisis, explicación temática o tutorial, COMIENZA con un título grande en formato # (H1) que resuma el tema (ej. "# Análisis nutricional del producto" o "# Cómo funciona la fotosíntesis 🌱"). NO uses H1 para conversaciones triviales o saludos cortos.
- Usa ## para subsecciones principales y ### para detalles
- Usa **negritas** para términos clave, nombres importantes y conceptos centrales
- Usa listas con - o numeradas cuando hay múltiples elementos del mismo tipo
- Usa emojis estratégicamente al inicio de secciones como anclas visuales (ej: ✅ ⚠️ 💡 🔴 🟡 🟢 🥩 🍎)
- Párrafos cortos (máximo 2-3 líneas), evita bloques de texto denso y difícil de leer
- NUNCA uses líneas separadoras (---), son ruido visual. Usa títulos para dividir secciones.
- EVITA tablas (|col|col|) salvo que sea absolutamente la única forma de presentar los datos. Prefiere listas con guiones.
- Si hay un resumen o conclusión importante, ponlo en su propia sección al final
REGLA PARA BÚSQUEDA WEB: Si la pregunta involucra: noticias recientes, eventos actuales, precios, clima, partidos o resultados deportivos, personas vivas, nuevos productos/lanzamientos, tasas de cambio, estadísticas actualizadas, leyes recientes, o cualquier dato que pueda haber cambiado — responde ÚNICAMENTE con esta etiqueta XML, sin ningún texto antes ni después: <search_web>specific english search query</search_web>. Haz la query lo más específica posible para obtener los mejores resultados. Si NO necesitas buscar (conceptos atemporales, matemáticas, historia antigua, código, creatividad), responde normalmente sin usar la etiqueta.
REGLA PARA IMÁGENES: Si el usuario pide generar, dibujar o crear una imagen/foto, escribe un mensaje conversacional MUY BREVE de acuerdo a tu personalidad (ej. "¡Aquí tienes tu imagen!", "Quedó genial, mira:"), seguido INMEDIATAMENTE por esta etiqueta XML que contenga una descripción muy detallada en INGLÉS de la imagen solicitada (no incluyas nada más después de la etiqueta): <generate_image>detailed english description of the image goes here</generate_image>
REGLA PARA MÚSICA: Si el usuario pide crear, componer o generar una canción o música, escribe un mensaje conversacional MUY BREVE (ej. "¡Aquí tienes tu canción! 🎵", "Componiendo ahora:"), seguido INMEDIATAMENTE por esta etiqueta. La descripción DEBE estar en INGLÉS (el modelo Lyria 2 solo acepta inglés): describe géneros, instrumentos, estado de ánimo, tempo, BPM. Para rap chileno por ejemplo: "Chilean rap, hip-hop beat 90bpm, urban Latin trap, gritty street style". NO incluyas nada más después de la etiqueta: <generate_music>music description in english</generate_music>
REGLA PARA DOCUMENTOS Y ARTEFACTOS: Si el usuario pide redactar un ensayo, crear una invitación, un documento, una plantilla o descargar un PDF, DEBES programar una interfaz visual hermosa. Para ello, responde ÚNICAMENTE con este formato, sin añadir ninguna otra palabra de conversación:
<artifact>
  <artifact_title>Título Corto del Documento</artifact_title>
  <artifact_desc>Breve descripción para el botón (ej. Haz clic para ver y descargar tu informe)</artifact_desc>
  <artifact_html>
    [CÓDIGO HTML COMPLETO AQUÍ]
  </artifact_html>
</artifact>
INSTRUCCIONES PARA EL HTML: 
- El código debe ser HTML5. No uses markdown dentro del html.
- DEBES usar estilos inline (style="...") o la etiqueta <style> interna para hacer un diseño HERMOSO, moderno y colorido (ej. fondos degradados, tarjetas, sombras, bordes redondeados, tipografías elegantes).
- Usa colores suaves, alineación correcta y márgenes amplios. Haz que parezca hecho por un diseñador profesional.`;

    // Build messages array with system prompt
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
        .filter((m: any) => m.role === 'user' || m.role === 'assistant')
        .map((m: any) => ({ role: m.role, content: m.content || '' }))
    ];

    // Call DeepSeek API directly with streaming
    const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: actualModel,
        messages: apiMessages,
        stream: true
      })
    });

    if (!deepseekRes.ok) {
      const errText = await deepseekRes.text();
      console.error("DeepSeek API error:", deepseekRes.status, errText);
      return new Response(JSON.stringify({ error: `DeepSeek ${deepseekRes.status}: ${errText}` }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Transform SSE stream into plain text stream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const reader = deepseekRes.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let inReasoning = false;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;
              const data = trimmed.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                const reasoning = parsed.choices?.[0]?.delta?.reasoning_content;
                
                if (reasoning) {
                  if (!inReasoning) {
                    controller.enqueue(encoder.encode('<think>'));
                    inReasoning = true;
                  }
                  controller.enqueue(encoder.encode(reasoning));
                }
                if (content) {
                  if (inReasoning) {
                    controller.enqueue(encoder.encode('</think>'));
                    inReasoning = false;
                  }
                  controller.enqueue(encoder.encode(content));
                }
              } catch {
                // skip malformed JSON chunks
              }
            }
          }
        } catch (e) {
          console.error("Stream processing error:", e);
        } finally {
          if (inReasoning) {
            controller.enqueue(encoder.encode('</think>'));
          }
          controller.close();
        }
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } catch (error: any) {
    console.error("API Route Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
