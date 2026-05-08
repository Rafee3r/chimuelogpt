import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const falKey = process.env.FAL_KEY;

    if (!falKey) {
      return NextResponse.json(
        { error: "La clave de Fal.ai (FAL_KEY) no está configurada." },
        { status: 500 }
      );
    }

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

  } catch (error) {
    console.error("Image API Route Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
