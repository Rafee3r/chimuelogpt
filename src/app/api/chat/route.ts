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

    const systemPrompt = `You are ChimueloGPT, a helpful assistant created for a family. Always be helpful, friendly, and respectful. 
IMPORTANT RULE FOR IMAGES: If the user explicitly asks you to generate, draw, or create an image, photo, or picture, DO NOT provide conversational text or explain anything. You must ONLY reply exactly with this XML tag containing a highly detailed description of the requested image in ENGLISH: <generate_image>detailed english description of the image goes here</generate_image>`;

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
          // Call Fal.ai API for FLUX.2 Pro
          try {
            const falResponse = await fetch("https://fal.run/fal-ai/flux-pro/v2", {
              method: "POST",
              headers: {
                "Authorization": `Key ${falKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                prompt: imagePrompt,
                image_size: "landscape_4_3", // Standard size, can be customized
                num_inference_steps: 25,
                guidance_scale: 3.5
              })
            });

            if (!falResponse.ok) {
              const falError = await falResponse.text();
              console.error("Fal.ai API Error:", falError);
              replyText = `Hubo un problema al generar la imagen con Fal.ai. Por favor intenta de nuevo.`;
            } else {
              const falData = await falResponse.json();
              const imageUrl = falData.images[0].url;
              replyText = `![Imagen Generada](${imageUrl})\n\n*Prompt: ${imagePrompt}*`;
            }
          } catch (e) {
            console.error("Fal.ai execution error:", e);
            replyText = `Hubo un error de conexión al generar la imagen.`;
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
