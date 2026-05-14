import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { prompt, imageBase64 } = await req.json();
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY no está configurada en el entorno." },
        { status: 500 }
      );
    }

    if (imageBase64) {
      // EDIT MODE — imagen de referencia + prompt de transformación
      const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      const mimeMatch = imageBase64.match(/data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

      const buffer = Buffer.from(base64Data, 'base64');
      const blob = new Blob([buffer], { type: mimeType });

      const form = new FormData();
      form.append('model', 'gpt-image-2');
      form.append('image', blob, 'reference.png');
      form.append('prompt', prompt);
      form.append('n', '1');
      form.append('size', 'auto');
      form.append('quality', 'auto');
      form.append('response_format', 'b64_json');

      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: form,
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('OpenAI image edit error:', res.status, err);
        return NextResponse.json(
          { error: `Error al editar imagen (${res.status})` },
          { status: 500 }
        );
      }

      const data = await res.json();
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) {
        return NextResponse.json({ error: 'Sin imagen en la respuesta de edición' }, { status: 500 });
      }
      return NextResponse.json({ url: `data:image/png;base64,${b64}` });

    } else {
      // GENERATE MODE — texto a imagen
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-2',
          prompt,
          n: 1,
          size: 'auto',
          quality: 'auto',
          response_format: 'b64_json',
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('OpenAI image generation error:', res.status, err);
        return NextResponse.json(
          { error: `Error al generar imagen (${res.status})` },
          { status: 500 }
        );
      }

      const data = await res.json();
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) {
        return NextResponse.json({ error: 'Sin imagen en la respuesta de generación' }, { status: 500 });
      }
      return NextResponse.json({ url: `data:image/png;base64,${b64}` });
    }

  } catch (error: any) {
    console.error('Image API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
