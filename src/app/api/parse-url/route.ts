import { NextResponse } from 'next/server';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'URL requerida.' }, { status: 400 });
    }

    const apiKey = process.env.TAVILY_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch('https://api.tavily.com/extract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            urls: [url],
            extract_depth: 'advanced' // advanced supports JavaScript-rendered pages like Canva
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const result = data.results?.[0];
          if (result && result.content) {
            return NextResponse.json({
              title: result.title || 'Contenido de la página',
              text: result.content
            });
          }
          if (data.failed_results?.[0]?.error) {
            console.warn('Tavily extract failed for url, trying fallback:', data.failed_results[0].error);
          }
        } else {
          console.warn('Tavily extract endpoint returned non-ok status, trying fallback:', res.status);
        }
      } catch (err) {
        console.error('Error invoking Tavily extract API, trying fallback:', err);
      }
    } else {
      console.warn('TAVILY_API_KEY is not configured, running fallback.');
    }

    // Fallback: simple fetch & raw text parsing
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const html = await res.text();
      
      // Extract title
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : 'Contenido de la página';

      // Clean HTML tags
      let text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return NextResponse.json({ title, text });
    } catch (fallbackErr: any) {
      console.error('Fallback scraper failed:', fallbackErr);
      return NextResponse.json({ error: `No se pudo acceder al enlace: ${fallbackErr.message}` }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Parse URL API Error:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
