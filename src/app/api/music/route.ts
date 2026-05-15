import { NextResponse } from 'next/server';

export const maxDuration = 120;

const MODEL = 'fal-ai/minimax-music/v2';

async function poll(statusUrl: string, falKey: string, maxMs = 100_000): Promise<any> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000));
    const res = await fetch(statusUrl, { headers: { 'Authorization': `Key ${falKey}` } });
    if (!res.ok) continue;
    const data = await res.json();
    if (data.status === 'COMPLETED') return data;
    if (data.status === 'FAILED') throw new Error(`FAL job failed: ${JSON.stringify(data)}`);
  }
  throw new Error('Music generation timed out after 100s');
}

function extractAudioUrl(data: any): string | null {
  return (
    data?.output?.audio?.url ||
    data?.output?.audio_file?.url ||
    data?.output?.audio_url ||
    data?.audio?.url ||
    data?.audio_file?.url ||
    data?.audio_url ||
    data?.url ||
    (Array.isArray(data?.output?.audio) ? data.output.audio[0]?.url : undefined) ||
    null
  );
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const falKey = process.env.FAL_KEY;

    if (!falKey) return NextResponse.json({ error: 'FAL_KEY no configurada.' }, { status: 500 });
    if (!prompt) return NextResponse.json({ error: 'Prompt requerido.' }, { status: 400 });

    // Submit to FAL queue (handles long-running models)
    const submitRes = await fetch(`https://queue.fal.run/${MODEL}`, {
      method: 'POST',
      headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt.slice(0, 500),
        // minimax-music/v2 requires lyrics_prompt; use [instrumental] if none provided
        lyrics_prompt: '[verse]\n[instrumental]',
      }),
    });

    if (!submitRes.ok) {
      const err = await submitRes.text();
      console.error('FAL music submit error:', submitRes.status, err);
      return NextResponse.json({ error: `FAL error ${submitRes.status}: ${err}` }, { status: 500 });
    }

    const queued = await submitRes.json();
    console.log('FAL music queued:', JSON.stringify(queued));

    // If synchronous response already has audio, return it
    const directUrl = extractAudioUrl(queued);
    if (directUrl) return NextResponse.json({ url: directUrl });

    // Otherwise poll the status URL
    const statusUrl = queued.status_url || queued.response_url;
    if (!statusUrl) {
      console.error('FAL music: no status_url in response', JSON.stringify(queued));
      return NextResponse.json({ error: 'No se pudo obtener el estado de la tarea.' }, { status: 500 });
    }

    const completed = await poll(statusUrl, falKey);
    console.log('FAL music completed:', JSON.stringify(completed).slice(0, 300));

    const audioUrl = extractAudioUrl(completed);
    if (!audioUrl) {
      return NextResponse.json({ error: 'No se encontró URL de audio en la respuesta.' }, { status: 500 });
    }

    return NextResponse.json({ url: audioUrl });
  } catch (error: any) {
    console.error('Music API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
