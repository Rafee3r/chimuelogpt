import { NextResponse } from 'next/server';

export const maxDuration = 120; // music generation can take up to ~60s

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const falKey = process.env.FAL_KEY;

    if (!falKey) {
      return NextResponse.json({ error: 'FAL_KEY no configurada.' }, { status: 500 });
    }

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Se requiere un prompt de música.' }, { status: 400 });
    }

    const falResponse = await fetch('https://fal.run/fal-ai/minimax-music/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt.slice(0, 500),
        lyrics_prompt: '',
      }),
    });

    if (!falResponse.ok) {
      const err = await falResponse.text();
      console.error('FAL music error:', falResponse.status, err);
      return NextResponse.json({ error: `Error al generar música (${falResponse.status})` }, { status: 500 });
    }

    const data = await falResponse.json();

    // Handle multiple possible response shapes from FAL
    const audioUrl =
      data?.audio?.url ||
      data?.audio_file?.url ||
      data?.audio_url ||
      data?.url ||
      (Array.isArray(data?.audio) ? data.audio[0]?.url : undefined);

    if (!audioUrl) {
      console.error('FAL music: unexpected response shape', JSON.stringify(data));
      return NextResponse.json({ error: 'No se recibió audio en la respuesta.' }, { status: 500 });
    }

    return NextResponse.json({ url: audioUrl });
  } catch (error: any) {
    console.error('Music API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
