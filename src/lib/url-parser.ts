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

export interface ColorCount {
  hex: string;
  count: number;
}

export interface ReadPageResult {
  ok: boolean;
  url: string;
  title: string;
  text: string;
  colors: ColorCount[];
  background: string;
  cta: string;
  error?: string;
}

export function rgbToHex(r: number | string, g: number | string, b: number | string): string {
  const rNum = Math.max(0, Math.min(255, parseInt(String(r), 10) || 0));
  const gNum = Math.max(0, Math.min(255, parseInt(String(g), 10) || 0));
  const bNum = Math.max(0, Math.min(255, parseInt(String(b), 10) || 0));
  return `#${[rNum, gNum, bNum].map((x) => x.toString(16).padStart(2, '0')).join('').toLowerCase()}`;
}

export function normalizeHex(h: string): string | null {
  if (!h) return null;
  let clean = h.trim().replace(/^#/, '').toLowerCase();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  } else if (clean.length === 4) {
    clean = clean.slice(0, 3).split('').map((c) => c + c).join('');
  } else if (clean.length === 8) {
    clean = clean.slice(0, 6);
  }
  if (clean.length === 6 && /^[0-9a-f]{6}$/.test(clean)) {
    return `#${clean}`;
  }
  return null;
}

/**
 * readPage - Extrae el contenido de texto verídico y la paleta exacta de colores (hex, background, cta)
 * a partir de los bloques <style>, variables CSS, y atributos inline de la URL.
 */
export async function readPage(rawUrl: string): Promise<ReadPageResult> {
  let url = (rawUrl || '').trim();
  if (!url) {
    return {
      ok: false,
      url: '',
      title: '',
      text: '',
      colors: [],
      background: '#ffffff',
      cta: '#000000',
      error: 'URL requerida.',
    };
  }

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

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
      return {
        ok: false,
        url,
        title: '',
        text: '',
        colors: [],
        background: '#ffffff',
        cta: '#000000',
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const html = await res.text();

    // 1. Título
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : 'Página Web';

    // 2. Extracción de estilos (etiquetas <style>, style="...", bgcolor="...", color="...")
    const styleBlocks = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
    const inlineStyles = html.match(/style=["'][^"']*["']/gi) || [];
    const bgColors = html.match(/bgcolor=["'][^"']*["']/gi) || [];
    const combinedStyles = [...styleBlocks, ...inlineStyles, ...bgColors].join('\n');

    const counts = new Map<string, number>();
    const addColor = (hex: string | null | undefined, weight = 1) => {
      if (!hex) return;
      const norm = normalizeHex(hex);
      if (!norm) return;
      counts.set(norm, (counts.get(norm) || 0) + weight);
    };

    // A. Hex en estilos (#rgb, #rrggbb, #rrggbbaa)
    const hexMatches = combinedStyles.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    for (const h of hexMatches) {
      addColor(h, 1);
    }

    // B. rgb(r, g, b) / rgba(r, g, b, a)
    const rgbMatches = combinedStyles.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi) || [];
    for (const rgb of rgbMatches) {
      const nums = rgb.match(/\d+/g);
      if (nums && nums.length >= 3) {
        addColor(rgbToHex(nums[0], nums[1], nums[2]), 1);
      }
    }

    // C. Variables CSS de color en formato de tripletes RGB (ej. Shopify: --color-base-accent-1: 139, 68, 233;)
    const varRgbMatches =
      combinedStyles.match(
        /--[a-zA-Z0-9_-]*(?:color|accent|btn|button|bg|background)[a-zA-Z0-9_-]*\s*:\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi
      ) || [];
    for (const vm of varRgbMatches) {
      const nums = vm.match(/\d+/g);
      if (nums && nums.length >= 3) {
        addColor(rgbToHex(nums[0], nums[1], nums[2]), 5);
      }
    }

    // D. Detección de CTA / Color principal de botón
    let cta = '';
    const ctaVarMatch = combinedStyles.match(
      /--(?:gradient-base-accent-1|color-base-accent-1|color-base-outline-button-labels|color-primary|primary-color|accent-color|brand-color|btn-primary-bg|button-bg)\s*:\s*([^;]+)/i
    );
    if (ctaVarMatch) {
      const val = ctaVarMatch[1].trim();
      const hex = val.match(/#[0-9a-fA-F]{3,6}/);
      if (hex) {
        cta = normalizeHex(hex[0]) || '';
      } else {
        const nums = val.match(/\d+/g);
        if (nums && nums.length >= 3) {
          cta = rgbToHex(nums[0], nums[1], nums[2]);
        }
      }
    }

    // E. Detección de background
    let background = '#ffffff';
    const bgVarMatch = combinedStyles.match(
      /--(?:gradient-base-background-1|color-base-background-1|bg-color|background-color)\s*:\s*([^;]+)/i
    );
    if (bgVarMatch) {
      const val = bgVarMatch[1].trim();
      const hex = val.match(/#[0-9a-fA-F]{3,6}/);
      if (hex) {
        background = normalizeHex(hex[0]) || '#ffffff';
      } else {
        const nums = val.match(/\d+/g);
        if (nums && nums.length >= 3) {
          background = rgbToHex(nums[0], nums[1], nums[2]);
        }
      }
    }

    const sorted = Array.from(counts.entries())
      .map(([hex, count]) => ({ hex, count }))
      .sort((a, b) => b.count - a.count);

    if (!cta) {
      const nonNeutral = sorted.find(
        (c) => !['#ffffff', '#000000', '#121212', '#f3f3f3', '#dbdbdb', '#e5e5e5', '#2e2a39'].includes(c.hex)
      );
      cta = nonNeutral ? nonNeutral.hex : (sorted[0]?.hex || '#000000');
    }

    // 3. Limpiar contenido HTML para texto verídico del negocio
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

    return {
      ok: true,
      url,
      title,
      text,
      colors: sorted,
      background,
      cta,
    };
  } catch (err: any) {
    return {
      ok: false,
      url,
      title: '',
      text: '',
      colors: [],
      background: '#ffffff',
      cta: '#000000',
      error: err?.message || 'Error al conectar con la URL.',
    };
  }
}

