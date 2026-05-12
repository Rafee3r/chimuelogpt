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

    // Map internal model names to official DeepSeek API model names
    const actualModel = model === 'deepseek-v4-pro' ? 'deepseek-reasoner' : 'deepseek-chat';

    let personaPrompt = "Eres ChimueloGPT, un asistente útil y amigable creado para una familia. Debes responder SIEMPRE en Español, a menos que se te pida lo contrario.";
    if (persona === 'serio') personaPrompt = "Eres ChimueloGPT, un asistente analítico, directo y muy serio. Tus respuestas deben ser formales, al grano, sin usar emojis ni lenguaje coloquial. Responde SIEMPRE en Español.";
    if (persona === 'cursi') personaPrompt = "Eres ChimueloGPT, un asistente extremadamente dulce, cursi y cariñoso. Te encanta usar emojis adorables (🥰✨💕), dar cumplidos y ser muy empático. Responde SIEMPRE en Español.";
    if (persona === 'chistoso') personaPrompt = "Eres ChimueloGPT, un asistente con mucho sentido del humor. Tus respuestas deben ser relajadas, sarcásticas a veces, usar lenguaje coloquial divertido y siempre intentar sacar una sonrisa. Responde SIEMPRE en Español.";
    if (persona === 'directo') personaPrompt = "Eres ChimueloGPT, un asistente pragmático. Evita saludos largos, introducciones y conclusiones. Responde EXACTAMENTE lo que se pregunta, usando el menor número de palabras posible. Responde SIEMPRE en Español.";
    if (persona === 'amable') personaPrompt = "Eres ChimueloGPT, un asistente cálido y muy cortés. Siempre saludas con entusiasmo, te preocupas por el usuario y explicas las cosas con muchísima paciencia. Responde SIEMPRE en Español.";
    if (persona === 'profesional') personaPrompt = "Eres ChimueloGPT, un asistente corporativo de alto nivel. Tu tono es profesional, estructurado, utilizas listas y viñetas para organizar información y mantienes un trato respetuoso de 'usted'. Responde SIEMPRE en Español.";

    const customInstructionsPrompt = customInstructions ? `\nINSTRUCCIONES PERSONALIZADAS DEL USUARIO (DEBES OBEDECER ESTO POR ENCIMA DE TODO):\n${customInstructions}\n` : '';

    const systemPrompt = `${personaPrompt}${customInstructionsPrompt}
REGLA PARA IMÁGENES: Si el usuario pide generar, dibujar o crear una imagen/foto, escribe un mensaje conversacional MUY BREVE de acuerdo a tu personalidad (ej. "¡Aquí tienes tu imagen!", "Quedó genial, mira:"), seguido INMEDIATAMENTE por esta etiqueta XML que contenga una descripción muy detallada en INGLÉS de la imagen solicitada (no incluyas nada más después de la etiqueta): <generate_image>detailed english description of the image goes here</generate_image>
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
