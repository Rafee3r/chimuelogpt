import { streamText } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';

export const maxDuration = 60; // 60 seconds timeout for Vercel Hobby

export async function POST(req: Request) {
  try {
    const { messages, model } = await req.json();
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key is missing. Please configure DEEPSEEK_API_KEY in Vercel." }), { status: 500 });
    }

    const deepseek = createDeepSeek({
      apiKey: apiKey,
    });

    // Map the model string to deepseek SDK models
    const actualModel = model === 'deepseek-v4-pro' ? 'deepseek-reasoner' : 'deepseek-chat';

    const systemPrompt = `Eres ChimueloGPT, un asistente útil y amigable creado para una familia. Debes responder SIEMPRE en Español, a menos que se te pida lo contrario.
REGLA PARA IMÁGENES: Si el usuario pide generar, dibujar o crear una imagen/foto, NO expliques nada. Responde ÚNICAMENTE con esta etiqueta XML que contenga una descripción muy detallada en INGLÉS de la imagen solicitada: <generate_image>detailed english description of the image goes here</generate_image>
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

    // Extract formatted messages for AI SDK
    const formattedMessages = messages.map((m: any) => {
      let content = m.content;
      if (m.parts) {
        content = m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');
      }
      return {
        role: m.role,
        content: content || ''
      };
    });

    // Deepseek AI SDK Call with streaming
    const result = streamText({
      model: deepseek(actualModel),
      system: systemPrompt,
      messages: formattedMessages,
    });

    return result.toTextStreamResponse();

  } catch (error: any) {
    console.error("API Route Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), { status: 500 });
  }
}
