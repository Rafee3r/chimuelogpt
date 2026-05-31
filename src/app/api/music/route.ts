import { NextResponse } from 'next/server';

export const maxDuration = 300;

const MODEL = 'fal-ai/lyria2';

function extractAudioUrl(data: any): string | null {
  return (
    data?.audio?.url ||
    data?.audio_file?.url ||
    data?.audio_url ||
    data?.url ||
    (Array.isArray(data?.audio) ? data.audio[0]?.url : undefined) ||
    null
  );
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const falKey = process.env.FAL_KEY;

    if (!falKey) return NextResponse.json({ error: 'FAL_KEY no configurada.' }, { status: 500 });
    if (!prompt) return NextResponse.json({ error: 'Prompt requerido.' }, { status: 400 });

    // 1. Submit job to FAL queue
    const submitRes = await fetch(`https://queue.fal.run/${MODEL}`, {
      method: 'POST',
      headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt.slice(0, 500),
      }),
    });

    if (!submitRes.ok) {
      const err = await submitRes.text();
      console.error('FAL music submit error:', submitRes.status, err);
      const friendlyError = err.includes('content_policy_violation') ? 
        'Lo siento, el sistema de generación de música rechazó la solicitud debido a sus filtros de seguridad. Intenta con una descripción diferente.' : 
        `Error al iniciar la generación de música (Código ${submitRes.status}).`;
      return NextResponse.json({ error: friendlyError }, { status: 500 });
    }

    const queued = await submitRes.json();
    console.log('FAL music queued:', JSON.stringify(queued));

    // If sync response already has audio (unlikely but possible), return it
    const directUrl = extractAudioUrl(queued);
    if (directUrl) return NextResponse.json({ url: directUrl });

    const statusUrl: string = queued.status_url;
    const responseUrl: string = queued.response_url;

    if (!statusUrl || !responseUrl) {
      console.error('FAL music: missing status_url/response_url', JSON.stringify(queued));
      return NextResponse.json({ error: 'FAL no devolvió URLs de seguimiento.' }, { status: 500 });
    }

    // 2. Poll status_url until COMPLETED (deadline 270s para Lyria 2 que puede tardar)
    const deadline = Date.now() + 270_000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 3000));

      const statusRes = await fetch(statusUrl, { headers: { 'Authorization': `Key ${falKey}` } });
      if (!statusRes.ok) continue;

      const status = await statusRes.json();
      console.log('FAL music status:', status.status);

      if (status.status === 'FAILED') {
        return NextResponse.json({ error: `Generación fallida: ${JSON.stringify(status)}` }, { status: 500 });
      }

      if (status.status === 'COMPLETED') {
        // 3. GET response_url to retrieve actual audio output
        const resultRes = await fetch(responseUrl, { headers: { 'Authorization': `Key ${falKey}` } });
        if (!resultRes.ok) {
          const err = await resultRes.text();
          console.error('FAL music result fetch error:', resultRes.status, err);
          const friendlyError = err.includes('content_policy_violation') ? 
            'Lo siento, el sistema de seguridad bloqueó el audio generado por contener elementos restringidos. Intenta con otra descripción.' : 
            `Error al obtener la música generada (Código ${resultRes.status}).`;
          return NextResponse.json({ error: friendlyError }, { status: 500 });
        }

        const result = await resultRes.json();
        console.log('FAL music result:', JSON.stringify(result).slice(0, 300));

        const audioUrl = extractAudioUrl(result);
        if (!audioUrl) {
          return NextResponse.json({ error: `Sin URL de audio en respuesta: ${JSON.stringify(result).slice(0, 200)}` }, { status: 500 });
        }

        return NextResponse.json({ url: audioUrl });
      }
    }

    return NextResponse.json({ error: 'Tiempo de espera agotado (100s).' }, { status: 500 });

  } catch (error: any) {
    console.error('Music API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
