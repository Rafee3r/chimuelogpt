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
      // DALL-E 2 no soporta img2img de forma nativa sin máscaras complejas.
      return NextResponse.json({ error: 'La edición de imágenes (img2img) no está disponible en este modelo.' }, { status: 400 });
    } else {
      // TEXT-TO-IMAGE usando DALL-E 2 (GPT 2.0 / Low resolution)
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "dall-e-2",
          prompt: prompt,
          n: 1,
          size: "256x256",
        })
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('OpenAI DALL-E error:', err);
        return NextResponse.json({ error: 'Error generando imagen con OpenAI' }, { status: 500 });
      }

      const data = await res.json();
      const url = data.data?.[0]?.url;
      if (!url) return NextResponse.json({ error: 'No se generó imagen' }, { status: 500 });
      
      return NextResponse.json({ url });
    }

  } catch (error: any) {
    console.error('Image API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
