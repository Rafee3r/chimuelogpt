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

    // If imageBase64 is provided, do img2img. Otherwise, text-to-image.
    if (imageBase64) {
      // Step 1: Upload the image to fal.ai storage
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const ext = mimeType.split('/')[1] || 'jpg';

      const uploadRes = await fetch('https://fal.run/fal-ai/file-upload', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${falKey}`,
          'Content-Type': mimeType,
          'X-Fal-File-Name': `upload.${ext}`
        },
        body: imageBuffer
      });

      let imageUrl: string;
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        imageUrl = uploadData.url || uploadData.file_url;
      } else {
        // Fallback: use a data URL directly (some endpoints accept it)
        imageUrl = imageBase64;
      }

      // Step 2: Call FLUX img2img
      const falResponse = await fetch("https://fal.run/fal-ai/flux/dev/image-to-image", {
        method: "POST",
        headers: {
          "Authorization": `Key ${falKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          image_url: imageUrl,
          prompt: prompt,
          strength: 0.75,
          num_inference_steps: 28,
          guidance_scale: 3.5
        })
      });

      if (!falResponse.ok) {
        const falError = await falResponse.text();
        console.error("Fal.ai img2img Error:", falError);
        return NextResponse.json(
          { error: `Error en img2img: ${falError}` },
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
      // Text-to-image (original flow)
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
        console.error("Fal.ai API Error:", falError);
        return NextResponse.json(
          { error: "Hubo un problema al generar la imagen con Fal.ai." },
          { status: 500 }
        );
      }

      const falData = await falResponse.json();
      const imageUrl = falData.images[0].url;

      return NextResponse.json({ url: imageUrl });
    }

  } catch (error: any) {
    console.error("Image API Route Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
