import { NextResponse } from 'next/server';

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { prompt, imageBase64 } = await req.json();
    const openAIKey = process.env.OPENAI_API_KEY;

    if (!openAIKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY no configurada.' }, { status: 500 });
    }

    if (imageBase64) {
      // gpt-image-2 soporta edición vía /v1/images/edits
      // Por ahora devolvemos error ya que requiere máscara
      return NextResponse.json({ error: 'La edición de imágenes (img2img) no está disponible aún.' }, { status: 400 });
    } else {
      // TEXT-TO-IMAGE usando gpt-image-2 (low detail, low resolution)
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "gpt-image-2",
          prompt: prompt,
          n: 1,
          size: "256x256",
          quality: "low",
        })
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('OpenAI gpt-image-2 error:', err);
        return NextResponse.json({ error: 'Error generando imagen con OpenAI' }, { status: 500 });
      }

      const data = await res.json();

      // gpt-image-2 puede devolver base64 o url
      const imageUrl = data.data?.[0]?.url;
      const imageB64 = data.data?.[0]?.b64_json;

      if (imageUrl) {
        return NextResponse.json({ url: imageUrl });
      } else if (imageB64) {
        // Devolver como data URI para que el frontend lo muestre directamente
        return NextResponse.json({ url: `data:image/png;base64,${imageB64}` });
      }

      return NextResponse.json({ error: 'No se generó imagen' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Image API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
