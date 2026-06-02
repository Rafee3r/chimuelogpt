import { NextResponse } from 'next/server';

export const maxDuration = 120;

/**
 * Convierte base64 (con o sin prefijo data:...) a un Blob/File
 * compatible con FormData para el endpoint /v1/images/edits
 */
function base64ToFile(base64Str: string, filename: string): File {
  const base64Data = base64Str.includes(',') ? base64Str.split(',')[1] : base64Str;
  const mimeMatch = base64Str.match(/data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
  const buffer = Buffer.from(base64Data, 'base64');
  const blob = new Blob([buffer], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
}

export async function POST(req: Request) {
  try {
    const { prompt, imageBase64 } = await req.json();
    const openAIKey = process.env.OPENAI_API_KEY;

    if (!openAIKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY no configurada.' }, { status: 500 });
    }

    if (imageBase64) {
      // ── IMG2IMG: Edición de imagen usando gpt-image-2 ──
      // Usa /v1/images/edits sin máscara → el modelo toma la imagen
      // como referencia visual y la modifica según el prompt.
      const imageFile = base64ToFile(imageBase64, 'input.png');

      const formData = new FormData();
      formData.append('model', 'gpt-image-2');
      formData.append('image', imageFile);
      formData.append('prompt', prompt);
      formData.append('n', '1');
      formData.append('size', '1280x720');
      formData.append('quality', 'low');

      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIKey}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('OpenAI gpt-image-2 edit error:', err);
        return NextResponse.json({ error: 'Error editando imagen con OpenAI' }, { status: 500 });
      }

      const data = await res.json();
      const imageUrl = data.data?.[0]?.url;
      const imageB64 = data.data?.[0]?.b64_json;

      if (imageUrl) {
        return NextResponse.json({ url: imageUrl });
      } else if (imageB64) {
        return NextResponse.json({ url: `data:image/png;base64,${imageB64}` });
      }

      return NextResponse.json({ error: 'No se generó imagen (edición)' }, { status: 500 });

    } else {
      // ── TEXT-TO-IMAGE usando gpt-image-2 (low detail, 720p) ──
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
          size: "1280x720",
          quality: "low",
        })
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('OpenAI gpt-image-2 error:', err);
        return NextResponse.json({ error: 'Error generando imagen con OpenAI' }, { status: 500 });
      }

      const data = await res.json();
      const imageUrl = data.data?.[0]?.url;
      const imageB64 = data.data?.[0]?.b64_json;

      if (imageUrl) {
        return NextResponse.json({ url: imageUrl });
      } else if (imageB64) {
        return NextResponse.json({ url: `data:image/png;base64,${imageB64}` });
      }

      return NextResponse.json({ error: 'No se generó imagen' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Image API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
