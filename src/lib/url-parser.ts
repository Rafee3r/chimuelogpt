/**
 * url-parser.ts - Extracción y scraping seguro de URLs para ChimuCode y Chimuelo
 */

export function extractUrlFromPrompt(prompt: string): string | null {
  if (!prompt || typeof prompt !== 'string') return null;

  // 1. URL explícita con esquema http o https
  const httpMatch = prompt.match(/\bhttps?:\/\/[^\s<>'")]+/i);
  if (httpMatch) {
    return httpMatch[0].replace(/[.,;:!?]+$/, '');
  }

  // 2. Dominio raíz o con ruta (ej: vada.cl, www.vada.cl, mi-sitio.com/productos)
  const domainMatch = prompt.match(
    /\b(?:www\.)?[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.(?:cl|com|org|net|io|co|dev|app|ai|es|lat|store|shop|online|site|tech|info|edu|gob|gov|ar|mx|pe|uy|br)(?:\/[^\s<>'")]+)?/i
  );
  if (domainMatch) {
    const raw = domainMatch[0].replace(/[.,;:!?]+$/, '');
    return `https://${raw}`;
  }

  return null;
}

export interface ScrapeUrlResult {
  ok: boolean;
  title?: string;
  text?: string;
  error?: string;
}

export async function scrapeUrlContent(rawUrl: string): Promise<ScrapeUrlResult> {
  let url = (rawUrl || '').trim();
  if (!url) {
    return { ok: false, error: 'URL requerida.' };
  }

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  // 1. Intentar con Tavily Extract si hay API key configurada
  const apiKey = process.env.TAVILY_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch('https://api.tavily.com/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          urls: [url],
          extract_depth: 'advanced',
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = await res.json();
        const result = data.results?.[0];
        if (result && result.content && result.content.trim().length > 30) {
          return {
            ok: true,
            title: result.title || 'Contenido de la página',
            text: result.content.trim(),
          };
        }
      }
    } catch {
      // Fallback a fetch directo
    }
  }

  // 2. Fallback: Fetch directo con User-Agent de navegador moderno
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const html = await res.text();

    // Extraer título
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : 'Contenido de la página';

    // Limpiar contenido HTML
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();

    if (!text || text.length < 20) {
      return { ok: false, error: 'La página no devolvió contenido de texto legible.' };
    }

    return { ok: true, title, text };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error al conectar con la URL.' };
  }
}
