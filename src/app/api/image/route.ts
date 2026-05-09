import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { prompt, imageBase64 } = await req.json();
    const falKey = process.env.FAL_KEY;

    if (!falKey) {
      return NextResponse.json(
        { error: "La clave de Fal.ai (FAL_KEY) no está configurada." },
        { status: 500 }
      );
    }

    if (imageBase64) {
      // IMG2IMG: Pass the data URL directly to FLUX img2img
      const falResponse = await fetch("https://fal.run/fal-ai/flux/dev/image-to-image", {
        method: "POST",
        headers: {
          "Authorization": `Key ${falKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          image_url: imageBase64,
          prompt: prompt,
          strength: 0.85,
          num_inference_steps: 28,
          guidance_scale: 3.5
        })
      });

      if (!falResponse.ok) {
        const falError = await falResponse.text();
        console.error("Fal.ai img2img Error:", falResponse.status, falError);
        return NextResponse.json(
          { error: `Error img2img: ${falError}` },
          { status: 500 }
        );
      }

      const falData = await falResponse.json();
      const resultUrl = falData.images?.[0]?.url;

      if (!resultUrl) {
        return NextResponse.json({ error: "No se generó imagen" }, { status: 500 });
      }

      return NextResponse.json({ url: resultUrl });

    } else {
      // TEXT-TO-IMAGE
      const falResponse = await fetch("https://fal.run/fal-ai/flux-pro/v1.1", {
        method: "POST",
        headers: {
          "Authorization": `Key ${falKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: prompt,
          image_size: "landscape_4_3"
        })
      });

      if (!falResponse.ok) {
        const falError = await falResponse.text();
        console.error("Fal.ai text2img Error:", falError);
        return NextResponse.json(
          { error: "Error al generar la imagen." },
          { status: 500 }
        );
      }

      const falData = await falResponse.json();
      return NextResponse.json({ url: falData.images[0].url });
    }

  } catch (error: any) {
    console.error("Image API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
