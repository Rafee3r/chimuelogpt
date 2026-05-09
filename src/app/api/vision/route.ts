export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages, imageBase64 } = await req.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY no configurada en Vercel." }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build the content array for the last user message with image
    const lastUserMsg = messages[messages.length - 1];
    const priorMessages = messages.slice(0, -1)
      .filter((m: any) => m.role === 'user' || m.role === 'assistant')
      .map((m: any) => ({ role: m.role, content: m.content || '' }));

    // Detect media type from base64 header
    const mediaTypeMatch = imageBase64?.match(/^data:(image\/\w+);base64,/);
    const mediaType = mediaTypeMatch ? mediaTypeMatch[1] : 'image/jpeg';
    const base64Data = imageBase64?.replace(/^data:image\/\w+;base64,/, '') || '';

    // Build content parts for the message with vision
    const contentParts: any[] = [];
    if (base64Data) {
      contentParts.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data
        }
      });
    }
    contentParts.push({
      type: 'text',
      text: lastUserMsg.content || 'Describe esta imagen.'
    });

    const anthropicMessages = [
      ...priorMessages,
      { role: 'user', content: contentParts }
    ];

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: `Eres ChimueloGPT, un asistente familiar amigable. Responde SIEMPRE en Español. Puedes ver y analizar imágenes.
REGLA PARA MODIFICACIÓN DE IMAGEN: Si el usuario quiere que MODIFIQUES, EDITES o crees una VERSIÓN MODIFICADA de la imagen que adjuntó (ej: "hazme con pelo verde", "ponme lentes", "cambia el fondo"), responde ÚNICAMENTE con esta etiqueta XML con una descripción MUY DETALLADA en INGLÉS de cómo debe verse la imagen final (incluye TODOS los detalles de la imagen original + las modificaciones pedidas): <generate_image>detailed english description of the final modified image</generate_image>
Si el usuario solo quiere que DESCRIBAS o EXPLIQUES la imagen, respóndele normalmente en español sin usar etiquetas.`,
        messages: anthropicMessages,
        stream: true
      })
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, errText);
      return new Response(JSON.stringify({ error: `Claude ${anthropicRes.status}: ${errText}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Transform Anthropic SSE stream into plain text stream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const reader = anthropicRes.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

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
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  controller.enqueue(encoder.encode(parsed.delta.text));
                }
              } catch {
                // skip malformed chunks
              }
            }
          }
        } catch (e) {
          console.error("Stream error:", e);
        } finally {
          controller.close();
        }
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      }
    });

  } catch (error: any) {
    console.error("Vision API Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
