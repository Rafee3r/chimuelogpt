import { NextResponse } from 'next/server';

export const maxDuration = 120;

// ── Subir base64 a FAL Storage → devuelve URL pública ──
async function uploadToFalStorage(imageBase64: string, falKey: string): Promise<string> {
  const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  const mimeType = imageBase64.match(/data:([^;]+);/)?.[1] || 'image/png';
  const buffer = Buffer.from(base64Data, 'base64');

  const res = await fetch('https://fal.ai/api/storage/upload/initiate', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content_type: mimeType,
      file_name: 'input.png',
    }),
  });

  if (!res.ok) {
    // Fallback: intentar endpoint legacy
    const legacyRes = await fetch('https://fal.run/fal-ai/any/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': mimeType,
        'X-Fal-File-Name': 'input.png',
      },
      body: buffer,
    });

    if (!legacyRes.ok) {
      // Último fallback: fal storage v1
      const storageRes = await fetch('https://storage.fal.ai/v1/files', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${falKey}`,
          'Content-Type': mimeType,
        },
        body: buffer,
      });
      if (!storageRes.ok) {
        const err = await storageRes.text();
        throw new Error(`FAL storage upload failed: ${err}`);
      }
      const data = await storageRes.json();
      return data.url || data.cdn_url;
    }

    const legacyData = await legacyRes.json();
    return legacyData.url || legacyData.file_url;
  }

  const initData = await res.json();
  // Upload al presigned URL
  await fetch(initData.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: buffer,
  });
  return initData.file_url;
}

// ── Extraer URL de imagen del response de FAL ──
function extractImageUrl(data: any): string | null {
  return (
    data?.output?.images?.[0]?.url ||
    data?.images?.[0]?.url ||
    data?.output?.image?.url ||
    data?.image?.url ||
    data?.output?.url ||
    data?.url ||
    data?.data?.[0]?.url ||
    null
  );
}

export async function POST(req: Request) {
  try {
    const { prompt, imageBase64 } = await req.json();
    const falKey = process.env.FAL_KEY;

    if (!falKey) {
      return NextResponse.json({ error: 'FAL_KEY no configurada.' }, { status: 500 });
    }

    if (imageBase64) {
      // ── IMG2IMG: gpt-image-2 edit vía fal.ai ──
      // 1) Subir imagen del usuario a FAL storage
      let imageUrl: string;
      try {
        imageUrl = await uploadToFalStorage(imageBase64, falKey);
        console.log('FAL storage upload OK:', imageUrl);
      } catch (e: any) {
        console.error('FAL storage error:', e.message);
        return NextResponse.json({ error: `Error subiendo imagen: ${e.message}` }, { status: 500 });
      }

      // 2) Llamar al endpoint de edición
      const res = await fetch('https://fal.run/openai/gpt-image-2/edit', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${falKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          image_url: imageUrl,
          quality: 'low',
          image_size: 'landscape_16_9',
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('FAL gpt-image-2 edit error:', err);
        return NextResponse.json({ error: `Error editando imagen: ${err}` }, { status: 500 });
      }

      const data = await res.json();
      const url = extractImageUrl(data);
      if (!url) {
        console.error('FAL edit response sin URL:', JSON.stringify(data));
        return NextResponse.json({ error: 'No se generó imagen (edición)' }, { status: 500 });
      }
      return NextResponse.json({ url });

    } else {
      // ── TEXT-TO-IMAGE: gpt-image-2 vía fal.ai ──
      const res = await fetch('https://fal.run/openai/gpt-image-2', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${falKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          image_size: 'landscape_16_9',
          quality: 'low',
          output_format: 'png',
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('FAL gpt-image-2 gen error:', err);
        return NextResponse.json({ error: `Error generando imagen: ${err}` }, { status: 500 });
      }

      const data = await res.json();
      const url = extractImageUrl(data);
      if (!url) {
        console.error('FAL gen response sin URL:', JSON.stringify(data));
        return NextResponse.json({ error: 'No se generó imagen' }, { status: 500 });
      }
      return NextResponse.json({ url });
    }

  } catch (error: any) {
    console.error('Image API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
