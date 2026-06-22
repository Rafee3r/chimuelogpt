export const maxDuration = 90;

export async function POST(req: Request) {
  try {
    const { messages = [], imageBase64, imagesBase64 = [], persona, customInstructions, model, isAgent } = await req.json();
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

    const lastUserMsg = messages[messages.length - 1]?.content || 'Describe esta imagen.';

    // Build list of base64 images to process
    const imagesToProcess = imagesBase64.length > 0 ? imagesBase64 : (imageBase64 ? [imageBase64] : []);
    
    // Build the user content block containing all images and the user prompt text
    const contentBlock: any[] = [];
    
    for (const imgBase64 of imagesToProcess) {
      const mediaTypeMatch = imgBase64?.match(/^data:([^;]+);base64,/);
      const mediaType = mediaTypeMatch ? mediaTypeMatch[1] : 'image/jpeg';
      const base64Data = imgBase64?.split('base64,')[1] || '';
      if (base64Data) {
        contentBlock.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Data
          }
        });
      }
    }
    
    contentBlock.push({ type: 'text', text: lastUserMsg });

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

JOB 2 — IMAGE ANALYSIS: If the user wants to understand, describe, or ask questions about the image, provide a comprehensive factual analysis in English covering: all visible objects, text/labels, people, colors, context, numbers, ingredients, brands, or any relevant details. Be thorough and precise — this analysis will be used by another AI to answer the user.

UNIVERSAL FORMATTING RULES (when you produce user-facing text — e.g. brief intro before generate_image tag):
- Use # H1 large title to introduce major topics or analyses
- Use **bold** for key terms, names, products
- Use ## for subsections, ### for details
- Use emoji anchors at section starts (✅ ⚠️ 💡 🔴 🟡 🟢 🥩 🍎)
- Short paragraphs (2-3 lines max)
- NEVER use --- (horizontal rule), it's visual noise — use headings instead
- AVOID tables (|col|col|) unless strictly necessary. Prefer bullet lists instead`,
        messages: [{
          role: 'user',
          content: contentBlock
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

    // ── Modo AGENTE: respuesta WhatsApp casual sobre la imagen ──
    const agentSystemPrompt = `${customInstructionsPrompt}
ESTÁS POR WHATSAPP. Eres un amigo cercano que está viendo la foto que te mandó la persona.
- Mensajes CORTOS (3-4 líneas máximo), conversacionales, como un amigo real.
- PROHIBIDO usar formato markdown: ni # títulos, ni **negritas**, ni listas con -, ni tablas, ni separadores.
- Tono casual, chileno, tutea ("oye mira", "fíjate que", "po").
- Reacciona primero a lo que ves antes de dar info ("ahh, sí lo conozco", "qué rico se ve eso").
- Emojis muy selectivos (1 cada 2-3 mensajes máximo, solo si calza).
- Si te piden info nutricional o detalles, dilos conversacional ("tiene como 200 calorías por porción, no es tanto") no en lista.

STICKERS (usa con moderación, máximo 1 cada 4-5 mensajes y solo cuando encaje natural):
Puedes mandar un sticker grande en lugar de palabras para expresar emoción intensa. Usa esta etiqueta sola, sin texto antes ni después: <sticker>EMOJI</sticker>
Stickers disponibles según contexto:
- 🥰 cuando alguien te muestra algo tierno (mascota, niño, regalo)
- 😂 cuando lo que ves te causa risa
- 🔥 cuando ves algo genial / impresionante
- 🥺 cuando ver a alguien triste o algo conmovedor
- 👏 felicitando un logro visible (graduación, deporte, comida bonita)
- 🤔 cuando dudas o algo te llama la atención
NO uses stickers en respuestas que requieran info concreta (recetas, nutrición, ayuda médica).

SIEMPRE responde en Español.`;

    const systemPrompt = isAgent ? agentSystemPrompt : `${personaPrompt}${customInstructionsPrompt}
REGLAS DE PERSONALIDAD Y EVITAR SUPOSICIONES (MUY IMPORTANTE):
1. **Personalidad Funcional y Precisa**: Sé útil, directo y sumamente cuidadoso. Si el usuario te hace una pregunta técnica vaga o ambigua (ej. "el generador no funciona", "mi coche no prende", "cómo configuro esto"), **NUNCA supongas o adivines el modelo, marca, tipo o contexto**. 
   - En lugar de asumir o inventar datos, **haz preguntas aclaratorias cortas y precisas** al usuario para acotar el problema antes de dar una solución detallada.
   - Evita dar instrucciones a ciegas que puedan ser incorrectas o peligrosas.
2. **Sin Botones Genéricos**: NUNCA generes botones, enlaces o sugerencias de formato corto como "más corto", "ejemplo", "resumir". Tus respuestas deben ser directas y completas desde el primer momento.
3. **Botones de Continuación Inteligentes (Markdown)**: Si consideras que el usuario se beneficiaría de continuar la conversación sobre un tema específico o explorar una alternativa de alto valor (como en el ejemplo de decorar una tabla recién hecha), **sugiérelo en tu texto y agrega un botón interactivo usando este formato de enlace exacto**: \`[Texto descriptivo del botón](prompt:Prompt de continuación completo y detallado)\`.
   - **FRECUENCIA Y CANTIDAD (MUY IMPORTANTE):** NO siempre debes sugerir estas opciones/botones. Úsalos con moderación, solo cuando de verdad aporten valor real y no se sienta repetitivo. La cantidad de botones NO debe ser siempre 3; varía según el contexto (puedes sugerir 1, 2 o ninguno si no es necesario).
   - **REGLA CRÍTICA DE DISEÑO:** El "Texto descriptivo del botón" (dentro de los corchetes) DEBE ser muy corto, conciso y de acción rápida (máximo de 2 a 4 palabras, por ejemplo: "Quiero decorarla" o "Ver técnicas"). NUNCA uses un texto largo o el prompt completo como título del botón. En cambio, el prompt de continuación (dentro del paréntesis \`prompt:...\`) SÍ debe ser la instrucción completa, detallada y ultra-eficiente que la IA recibirá al pulsarlo.
   - Ejemplo: \`Si te interesa, puedo ayudarte a decorarla: [Quiero decorarla](prompt:Explícame detalladamente qué técnicas de lijado, barnizado y diseño estético puedo aplicar para decorar la tabla de madera que acabamos de diseñar)\`.

FORMATO DE RESPUESTA: Organiza tus respuestas de forma visual y escaneable:
- COMIENZA con un título # H1 grande que resuma el tema cuando estés analizando una imagen (ej. "# Análisis de lo que estás consumiendo 🥩" o "# Información del producto").
- Usa ## para subsecciones principales y ### para detalles
- Usa **negritas** para términos clave, nombres, ingredientes, productos
- Usa listas con guiones (-) para elementos normales y listas numeradas (1. 2. 3.) para planes, guías paso a paso o cronogramas (se renderizan como una hermosa línea de tiempo con círculos numerados y conectores punteados)
- Usa emojis al inicio de secciones como anclas visuales (ej: ✅ ⚠️ 💡 🔴 🟡 🟢)
- Párrafos cortos (máximo 2-3 líneas), evita bloques de texto densos
- NUNCA uses líneas separadoras (---), son ruido visual
- Usa tablas markdown (|col|col|) para presentar planes estructurados, resúmenes o datos comparativos de manera limpia, moderna y profesional (se renderizan sin bordes verticales y con la primera columna destacada)`;

    const jsonSystemPrompt = systemPrompt + '\n\nResponde ÚNICAMENTE con un objeto JSON válido que contenga un array de strings llamado "messages" con los fragmentos de tu respuesta (de 1 a 4 mensajes cortos, tal como se enviarían en WhatsApp de forma natural). No agregues texto fuera del JSON.\nEjemplo de formato:\n{\n  "messages": [\n    "hola",\n    "cómo estai?"\n  ]\n}';

    // Build DeepSeek messages with Claude's image analysis injected
    const history = messages
      .slice(0, -1)
      .filter((m: any) => (m.role === 'user' || m.role === 'assistant') && m.content)
      .map((m: any) => ({ role: m.role, content: String(m.content) }));

    const deepseekMessages = [
      { role: 'system', content: isAgent ? jsonSystemPrompt : systemPrompt },
      ...history,
      {
        role: 'user',
        content: `[ANÁLISIS VISUAL DE LA IMAGEN ADJUNTA]\n${claudeAnalysis}\n[FIN DEL ANÁLISIS]\n\n${lastUserMsg}`
      }
    ];

    if (isAgent) {
      const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekKey}`
        },
        body: JSON.stringify({
          model: actualModel,
          messages: deepseekMessages,
          response_format: { type: 'json_object' },
          stream: false
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

      const resData = await deepseekRes.json();
      let content = resData.choices?.[0]?.message?.content || '{"messages":[]}';

      // Sanitize: strip markdown code fences if present
      content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

      // Validate JSON — if the model returned non-JSON text, wrap it
      try {
        const parsed = JSON.parse(content);
        // Ensure it has the expected shape and contains non-empty fragments
        if (!parsed.messages || !Array.isArray(parsed.messages) || parsed.messages.length === 0) {
          const fallbackText = parsed.content || parsed.message || parsed.text || "No alcancé a cachar bien qué era, me lo mostrái de nuevo?";
          content = JSON.stringify({ messages: [typeof fallbackText === 'string' ? fallbackText : JSON.stringify(fallbackText)] });
        } else {
          // Filter out empty/whitespace-only messages
          const activeMsgs = parsed.messages.map((m: any) => String(m).trim()).filter((m: string) => m.length > 0);
          if (activeMsgs.length === 0) {
            content = JSON.stringify({ messages: ["No alcancé a cachar bien qué era, me lo mostrái de nuevo?"] });
          } else {
            content = JSON.stringify({ messages: activeMsgs });
          }
        }
      } catch {
        // Not valid JSON at all — wrap the raw text as a single message
        const trimmedContent = content.trim();
        content = JSON.stringify({ messages: [trimmedContent || "No alcancé a cachar bien qué era, me lo mostrái de nuevo?"] });
      }

      return new Response(content, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        }
      });
    }

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
