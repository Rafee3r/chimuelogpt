import { NextResponse } from 'next/server';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) return NextResponse.json({ error: 'TAVILY_API_KEY no configurada.' }, { status: 500 });
    if (!query) return NextResponse.json({ error: 'Query requerido.' }, { status: 400 });

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: query.slice(0, 400),
        search_depth: 'basic',
        max_results: 5,
        include_answer: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Tavily error:', res.status, err);
      return NextResponse.json({ error: `Tavily ${res.status}: ${err}` }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({ results: data.results || [] });

  } catch (error: any) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
