export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages, imageBase64, persona, customInstructions } = await req.json();
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

    let personaPrompt = "Eres ChimueloGPT, un asistente familiar amigable. Responde SIEMPRE en Español. Puedes ver y analizar imágenes.";
    if (persona === 'serio') personaPrompt = "Eres ChimueloGPT, un asistente analítico, directo y muy serio. Tus respuestas deben ser formales, al grano, sin usar emojis. Responde SIEMPRE en Español. Puedes ver y analizar imágenes.";
    if (persona === 'cursi') personaPrompt = "Eres ChimueloGPT, un asistente extremadamente dulce, cursi y cariñoso. Te encanta usar emojis adorables (🥰✨💕). Responde SIEMPRE en Español. Puedes ver y analizar imágenes.";
    if (persona === 'chistoso') personaPrompt = "Eres ChimueloGPT, un asistente con mucho sentido del humor. Tus respuestas deben ser relajadas, sarcásticas a veces, usar lenguaje coloquial divertido. Responde SIEMPRE en Español. Puedes ver y analizar imágenes.";
    if (persona === 'directo') personaPrompt = "Eres ChimueloGPT, un asistente pragmático. Evita saludos largos, responde EXACTAMENTE lo que se pregunta, sin relleno. Responde SIEMPRE en Español. Puedes ver y analizar imágenes.";
    if (persona === 'amable') personaPrompt = "Eres ChimueloGPT, un asistente cálido y muy cortés. Siempre saludas con entusiasmo y explicas con paciencia. Responde SIEMPRE en Español. Puedes ver y analizar imágenes.";
    if (persona === 'profesional') personaPrompt = "Eres ChimueloGPT, un corporativo de alto nivel. Tu tono es profesional, estructurado, utilizas un trato respetuoso. Responde SIEMPRE en Español. Puedes ver y analizar imágenes.";

    const customInstructionsPrompt = customInstructions ? `\nINSTRUCCIONES PERSONALIZADAS DEL USUARIO (DEBES OBEDECER ESTO POR ENCIMA DE TODO):\n${customInstructions}\n` : '';

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
        system: `${personaPrompt}${customInstructionsPrompt}
REGLAS PARA MODIFICACIÓN/CREACIÓN DE IMÁGENES:
Si el usuario pide editar o transformar la foto adjunta, debes decidir el modo de generación y responder ÚNICAMENTE con esta etiqueta XML (no agregues texto adicional):

1. MODO IMG2IMG (Ediciones menores): Si pide cambiar color de pelo, ropa, agregar lentes, o cambiar el fondo, pero MANTENIENDO la anatomía y estructura humana original:
<generate_image mode="img2img">Descripción EN INGLÉS MUY DETALLADA de la imagen final, incluyendo todos los rasgos originales de la persona + las modificaciones</generate_image>

2. MODO TEXT2IMG (Transformaciones drásticas): Si pide convertirse en animal (ej: pony, perro), caricatura, estilo anime, Pixar, 3D, o cambiar de género. Aquí extraerás sus características visuales (ropa, color de pelo, pose) y crearás un prompt desde cero:
<generate_image mode="text2img">Descripción EN INGLÉS MUY DETALLADA del nuevo personaje (ej: A my little pony character with brown hair and a brown jacket...) en el estilo solicitado</generate_image>

Si el usuario SOLO pide describir o explicar la imagen, responde normalmente en español sin usar la etiqueta.`,
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
