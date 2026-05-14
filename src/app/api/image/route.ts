import { NextResponse } from 'next/server';

export const maxDuration = 60;

// Upload a base64 data URL to FAL storage and return an HTTP URL
async function uploadToFalStorage(imageBase64: string, falKey: string): Promise<string> {
  const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  const mimeType = imageBase64.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
  const buffer = Buffer.from(base64Data, 'base64');

  const uploadRes = await fetch('https://storage.fal.ai/v1/files', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': mimeType,
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`FAL storage upload failed (${uploadRes.status}): ${err}`);
  }

  const uploadData = await uploadRes.json();
  const url = uploadData.url || uploadData.cdn_url;
  if (!url) throw new Error('FAL storage upload returned no URL');
  return url;
}

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
      // IMG2IMG: Upload to FAL storage first (fal.ai requires an HTTP URL, not base64)
      let imageUrl: string;
      try {
        imageUrl = await uploadToFalStorage(imageBase64, falKey);
      } catch (uploadErr: any) {
        console.error('FAL storage upload error:', uploadErr);
        return NextResponse.json({ error: `Error al subir imagen: ${uploadErr.message}` }, { status: 500 });
      }

      const falResponse = await fetch("https://fal.run/fal-ai/flux/dev/image-to-image", {
        method: "POST",
        headers: {
          "Authorization": `Key ${falKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          image_url: imageUrl,
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
