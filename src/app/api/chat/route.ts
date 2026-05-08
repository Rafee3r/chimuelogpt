import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages, model } = await req.json();

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const falKey = process.env.FAL_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is missing. Please configure DEEPSEEK_API_KEY in Vercel." },
        { status: 500 }
      );
    }

    const actualModel = model || "deepseek-v4-pro";

    const formattedMessages = messages.map((m: any) => {
      if (m.image) {
        return {
          role: m.role,
          content: [
            { type: "text", text: m.content || " " },
            { type: "image_url", image_url: { url: m.image } }
          ]
        };
      }
      return {
        role: m.role,
        content: m.content
      };
    });

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

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: actualModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...formattedMessages
        ],
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DeepSeek API Error:", errorText);
      return NextResponse.json(
        { error: "Failed to communicate with DeepSeek API." },
        { status: response.status }
      );
    }

    const data = await response.json();
    let replyText = data.choices[0].message.content;

    // Intercept image generation tags
    if (replyText.includes("<generate_image>") && replyText.includes("</generate_image>")) {
      const promptMatch = replyText.match(/<generate_image>([\s\S]*?)<\/generate_image>/i);
      
      if (promptMatch && promptMatch[1]) {
        const imagePrompt = promptMatch[1].trim();
        
        if (!falKey) {
          replyText = `Lo siento, no he podido generar la imagen porque la clave de Fal.ai (\`FAL_KEY\`) no está configurada en Vercel.\n\n*Prompt intentado: ${imagePrompt}*`;
        } else {
          // Call Fal.ai API for FLUX
          try {
            const falResponse = await fetch("https://fal.run/fal-ai/flux-pro/v1.1", {
              method: "POST",
              headers: {
                "Authorization": `Key ${falKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                prompt: imagePrompt,
                image_size: "landscape_4_3"
              })
            });

            if (!falResponse.ok) {
              const falError = await falResponse.text();
              console.error("Fal.ai API Error:", falError);
              replyText = `Hubo un problema al generar la imagen con Fal.ai: \n\`\`\`\n${falError}\n\`\`\`\nPor favor intenta de nuevo.`;
            } else {
              const falData = await falResponse.json();
              const imageUrl = falData.images[0].url;
              replyText = `![Imagen Generada](${imageUrl})`;
            }
          } catch (e: any) {
            console.error("Fal.ai execution error:", e);
            replyText = `Hubo un error de conexión al generar la imagen: ${e.message}`;
          }
        }
      }
    }
    
    return NextResponse.json({
      reply: replyText
    });

  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
