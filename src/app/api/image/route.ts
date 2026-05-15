import { NextResponse } from 'next/server';

export const maxDuration = 120;

const IMG2IMG_MODEL = 'fal-ai/flux/dev/image-to-image';
const TEXT2IMG_MODEL = 'fal-ai/flux-pro/v1.1';

// Upload base64 image to FAL storage and return an HTTP URL
async function uploadToFalStorage(imageBase64: string, falKey: string): Promise<string> {
  const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  const mimeType = imageBase64.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
  const buffer = Buffer.from(base64Data, 'base64');

  const res = await fetch('https://storage.fal.ai/v1/files', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': mimeType,
    },
    body: buffer,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`FAL storage upload failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  const url = data.url || data.cdn_url;
  if (!url) throw new Error(`FAL storage returned no URL: ${JSON.stringify(data)}`);
  return url;
}

// Poll a FAL queue status URL until COMPLETED or FAILED
async function pollFalQueue(statusUrl: string, falKey: string, maxMs = 90_000): Promise<any> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2500));
    const res = await fetch(statusUrl, {
      headers: { 'Authorization': `Key ${falKey}` },
    });
    if (!res.ok) continue;
    const data = await res.json();
    if (data.status === 'COMPLETED') return data;
    if (data.status === 'FAILED') throw new Error(`FAL job failed: ${JSON.stringify(data)}`);
  }
  throw new Error('FAL job timed out');
}

// Extract image URL from various FAL response shapes
function extractImageUrl(data: any): string | null {
  return (
    data?.output?.images?.[0]?.url ||
    data?.images?.[0]?.url ||
    data?.output?.image?.url ||
    data?.image?.url ||
    data?.output?.url ||
    data?.url ||
    null
  );
}

// Submit to FAL (queue or sync) and return the final result
async function falRequest(model: string, payload: object, falKey: string): Promise<any> {
  // Try sync endpoint first
  const syncRes = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!syncRes.ok) {
    const err = await syncRes.text();
    throw new Error(`FAL ${model} error (${syncRes.status}): ${err}`);
  }

  const syncData = await syncRes.json();

  // If sync response already has an image, return it
  if (extractImageUrl(syncData)) return syncData;

  // Otherwise it's a queue response — poll status_url
  const statusUrl = syncData.status_url || syncData.response_url;
  if (!statusUrl) throw new Error(`FAL returned no image and no status_url: ${JSON.stringify(syncData)}`);

  return pollFalQueue(statusUrl, falKey);
}

export async function POST(req: Request) {
  try {
    const { prompt, imageBase64 } = await req.json();
    const falKey = process.env.FAL_KEY;

    if (!falKey) {
      return NextResponse.json({ error: 'FAL_KEY no configurada.' }, { status: 500 });
    }

    if (imageBase64) {
      // IMG2IMG — upload reference image to FAL storage first (FLUX requires HTTP URL)
      let imageUrl: string;
      try {
        imageUrl = await uploadToFalStorage(imageBase64, falKey);
        console.log('FAL storage upload OK:', imageUrl);
      } catch (e: any) {
        console.error('FAL storage error:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
      }

      let result: any;
      try {
        result = await falRequest(IMG2IMG_MODEL, {
          image_url: imageUrl,
          prompt,
          strength: 0.85,
          num_inference_steps: 28,
          guidance_scale: 3.5,
        }, falKey);
      } catch (e: any) {
        console.error('FAL img2img error:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
      }

      const url = extractImageUrl(result);
      if (!url) return NextResponse.json({ error: 'No se generó imagen (img2img)' }, { status: 500 });
      return NextResponse.json({ url });

    } else {
      // TEXT-TO-IMAGE
      let result: any;
      try {
        result = await falRequest(TEXT2IMG_MODEL, {
          prompt,
          image_size: 'landscape_4_3',
        }, falKey);
      } catch (e: any) {
        console.error('FAL text2img error:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
      }

      const url = extractImageUrl(result);
      if (!url) return NextResponse.json({ error: 'No se generó imagen (text2img)' }, { status: 500 });
      return NextResponse.json({ url });
    }

  } catch (error: any) {
    console.error('Image API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
