import { NextResponse } from 'next/server';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) return NextResponse.json({ error: 'TAVILY_API_KEY no configurada.' }, { status: 500 });
    if (!query) return NextResponse.json({ error: 'Query requerido.' }, { status: 400 });

    /* Cortamos a los 20s: el cliente espera 25s, así devolvemos un error
       manejable antes de que él se rinda (y antes del límite de la función). */
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 20_000);

    let res: Response;
    try {
      res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: query.slice(0, 400),
          search_depth: 'basic',
          max_results: 5,   // menos resultados = respuesta más rápida
          include_answer: true,
          include_raw_content: false,
        }),
        signal: ctrl.signal,
      });
    } catch (e: any) {
      clearTimeout(timeoutId);
      const timedOut = e?.name === 'AbortError';
      console.error('Tavily fetch falló:', timedOut ? 'timeout 20s' : e);
      return NextResponse.json(
        { error: timedOut ? 'La búsqueda tardó demasiado' : 'No se pudo conectar al buscador' },
        { status: 504 }
      );
    }
    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.text();
      console.error('Tavily error:', res.status, err);
      return NextResponse.json({ error: `Tavily ${res.status}: ${err}` }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({
      results: data.results || [],
      answer: data.answer || ''
    });

  } catch (error: any) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
