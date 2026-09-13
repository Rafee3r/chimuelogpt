import { NextResponse } from 'next/server';

export const maxDuration = 120;

function falKey(): string | undefined {
  const raw = process.env.FAL_KEY || process.env.FAL_API_KEY;
  if (!raw) return undefined;
  const trimmed = raw.trim().replace(/^["']|["']$/g, '');
  return trimmed || undefined;
}

function extractImageUrl(data: any): string | null {
  return (
    data?.images?.[0]?.url ||
    data?.output?.images?.[0]?.url ||
    data?.image?.url ||
    data?.output?.image?.url ||
    data?.output?.url ||
    data?.url ||
    data?.data?.[0]?.url ||
    null
  );
}

async function falQueue(model: string, input: object, key: string, timeoutMs = 90_000): Promise<any> {
  const auth = { Authorization: `Key ${key}` };

  const submitRes = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const queued = await submitRes.json().catch(() => ({}));
  if (!submitRes.ok) {
    const err = typeof queued === 'object' ? JSON.stringify(queued).slice(0, 400) : String(queued);
    throw new Error(`FAL ${submitRes.status}: ${err}`);
  }

  if (extractImageUrl(queued)) return queued;

  const statusUrl: string | undefined = queued.status_url;
  const responseUrl: string | undefined = queued.response_url;
  if (!statusUrl || !responseUrl) {
    throw new Error(`FAL no devolvió cola ni imagen: ${JSON.stringify(queued).slice(0, 300)}`);
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await fetch(statusUrl, { headers: auth });
    if (!statusRes.ok) continue;
    const status = await statusRes.json();
    if (status.status === 'FAILED') {
      throw new Error(`FAL falló: ${JSON.stringify(status).slice(0, 300)}`);
    }
    if (status.status === 'COMPLETED') {
      const resultRes = await fetch(responseUrl, { headers: auth });
      if (!resultRes.ok) {
        const err = await resultRes.text();
        throw new Error(`FAL resultado ${resultRes.status}: ${err.slice(0, 300)}`);
      }
      return resultRes.json();
    }
  }
  throw new Error('Tiempo de espera agotado generando la imagen.');
}

export async function POST(req: Request) {
  try {
    const { prompt, imageBase64 } = await req.json();
    const key = falKey();

    if (!key) {
      return NextResponse.json({ error: 'FAL_KEY no configurada.' }, { status: 500 });
    }
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt requerido.' }, { status: 400 });
    }

    const input = {
      prompt,
      image_size: 'auto',
      quality: 'low',
      output_format: 'png',
    };

    let data: any;
    if (imageBase64) {
      const dataUri = imageBase64.startsWith('data:')
        ? imageBase64
        : `data:image/png;base64,${imageBase64}`;
      data = await falQueue('openai/gpt-image-2.5/flare/edit', {
        ...input,
        image_urls: [dataUri],
      }, key);
    } else {
      data = await falQueue('openai/gpt-image-2.5/flare/text-to-image', input, key);
    }

    const url = extractImageUrl(data);
    if (!url) {
      console.error('FAL response sin URL:', JSON.stringify(data).slice(0, 400));
      return NextResponse.json({ error: 'No se generó imagen' }, { status: 500 });
    }
    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Image API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
