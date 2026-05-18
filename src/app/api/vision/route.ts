export const maxDuration = 90;

export async function POST(req: Request) {
  try {
    const { messages, imageBase64, persona, customInstructions, model } = await req.json();
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const deepseekKey = process.env.DEEPSEEK_API_KEY;

    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY no configurada." }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!deepseekKey) {
      return new Response(JSON.stringify({ error: "DEEPSEEK_API_KEY no configurada." }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    const mediaTypeMatch = imageBase64?.match(/^data:([^;]+);base64,/);
    const mediaType = mediaTypeMatch ? mediaTypeMatch[1] : 'image/jpeg';
    const base64Data = imageBase64?.split('base64,')[1] || '';

    const lastUserMsg = messages[messages.length - 1]?.content || 'Describe esta imagen.';

    // ── Step 1: Claude Haiku analyzes the image (non-streaming) ──
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        system: `You are a vision analysis system. You have two jobs depending on the user request:

JOB 1 — IMAGE EDITING: If the user's message asks to edit, modify, transform, or stylize this image, respond ONLY with the appropriate XML tag (no other text):
- Minor edits (hair color, clothing, background, accessories): <generate_image mode="img2img" strength="0.7">Extremely detailed english description of the final image, including all original facial features, body, pose, setting + the requested changes</generate_image>
- Major transformations (anime, cartoon, animal, gender swap, Pixar, 3D style): <generate_image mode="text2img">Extremely detailed english description of the new character/scene from scratch in the requested style</generate_image>
Use strength="0.35" for exact face/text preservation, strength="0.6" for medium edits, strength="0.85" for major style changes.

JOB 2 — IMAGE ANALYSIS: If the user wants to understand, describe, or ask questions about the image, provide a comprehensive factual analysis in English covering: all visible objects, text/labels, people, colors, context, numbers, ingredients, brands, or any relevant details. Be thorough and precise — this analysis will be used by another AI to answer the user.`,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
            { type: 'text', text: lastUserMsg }
          ]
        }]
      })
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return new Response(JSON.stringify({ error: `Claude vision error: ${err}` }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    const claudeData = await claudeRes.json();
    const claudeAnalysis = claudeData.content?.[0]?.text || '';

    // ── If Claude returned an image editing tag, stream it directly ──
    if (claudeAnalysis.includes('<generate_image')) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(claudeAnalysis));
          controller.close();
        }
      });
      return new Response(readable, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' }
      });
    }

    // ── Step 2: DeepSeek generates the final response using Claude's analysis ──
    const actualModel = model === 'deepseek-v4-pro' ? 'deepseek-v4-pro' : 'deepseek-v4-flash';

    let personaPrompt = "Eres ChimueloGPT, un asistente útil y amigable creado por Rafael para su familia. Debes responder SIEMPRE en Español, a menos que se te pida lo contrario.";
    if (persona === 'serio') personaPrompt = "Eres ChimueloGPT, un asistente analítico, directo y muy serio, creado por Rafael. Tus respuestas deben ser formales, al grano, sin usar emojis. Responde SIEMPRE en Español.";
    if (persona === 'cursi') personaPrompt = "Eres ChimueloGPT, un asistente extremadamente dulce, cursi y cariñoso, creado por Rafael para su familia. Te encanta usar emojis adorables (🥰✨💕). Responde SIEMPRE en Español.";
    if (persona === 'chistoso') personaPrompt = "Eres ChimueloGPT, un asistente con mucho sentido del humor, creado por Rafael. Tus respuestas deben ser relajadas y sarcásticas a veces. Responde SIEMPRE en Español.";
    if (persona === 'directo') personaPrompt = "Eres ChimueloGPT, un asistente pragmático creado por Rafael. Evita saludos largos. Responde EXACTAMENTE lo que se pregunta, usando el menor número de palabras posible. Responde SIEMPRE en Español.";
    if (persona === 'amable') personaPrompt = "Eres ChimueloGPT, un asistente cálido y muy cortés creado por Rafael para su familia. Siempre saludas con entusiasmo y explicas con muchísima paciencia. Responde SIEMPRE en Español.";
    if (persona === 'profesional') personaPrompt = "Eres ChimueloGPT, un asistente corporativo de alto nivel creado por Rafael. Tu tono es profesional y estructurado. Responde SIEMPRE en Español.";

    const customInstructionsPrompt = customInstructions ? `\nINSTRUCCIONES PERSONALIZADAS (PRIORIDAD MÁXIMA):\n${customInstructions}\n` : '';

    const systemPrompt = `${personaPrompt}${customInstructionsPrompt}
FORMATO DE RESPUESTA: Organiza tus respuestas de forma visual y escaneable:
- COMIENZA con un título # H1 grande que resuma el tema cuando estés analizando una imagen (ej. "# Análisis de lo que estás consumiendo 🥩" o "# Información del producto").
- Usa ## para subsecciones principales y ### para detalles
- Usa **negritas** para términos clave, nombres, ingredientes, productos
- Usa listas (- o 1.) para enumerar múltiples elementos del mismo tipo
- Usa emojis al inicio de secciones como anclas visuales (ej: ✅ ⚠️ 💡 🔴 🟡 🟢)
- Párrafos cortos (máximo 2-3 líneas), evita bloques de texto densos
- NUNCA uses líneas separadoras (---), son ruido visual`;

    // Build DeepSeek messages with Claude's image analysis injected
    const history = messages
      .slice(0, -1)
      .filter((m: any) => (m.role === 'user' || m.role === 'assistant') && m.content)
      .map((m: any) => ({ role: m.role, content: String(m.content) }));

    const deepseekMessages = [
      { role: 'system', content: systemPrompt },
      ...history,
      {
        role: 'user',
        content: `[ANÁLISIS VISUAL DE LA IMAGEN ADJUNTA]\n${claudeAnalysis}\n[FIN DEL ANÁLISIS]\n\n${lastUserMsg}`
      }
    ];

    const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekKey}`
      },
      body: JSON.stringify({ model: actualModel, messages: deepseekMessages, stream: true })
    });

    if (!deepseekRes.ok) {
      const err = await deepseekRes.text();
      return new Response(JSON.stringify({ error: `DeepSeek error: ${err}` }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Transform DeepSeek SSE stream into plain text stream
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
                  if (!inReasoning) { controller.enqueue(encoder.encode('<think>')); inReasoning = true; }
                  controller.enqueue(encoder.encode(reasoning));
                }
                if (content) {
                  if (inReasoning) { controller.enqueue(encoder.encode('</think>')); inReasoning = false; }
                  controller.enqueue(encoder.encode(content));
                }
              } catch { /* skip malformed */ }
            }
          }
        } catch (e) {
          console.error('Vision stream error:', e);
        } finally {
          if (inReasoning) controller.enqueue(encoder.encode('</think>'));
          controller.close();
        }
      }
    });

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' }
    });

  } catch (error: any) {
    console.error('Vision API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
