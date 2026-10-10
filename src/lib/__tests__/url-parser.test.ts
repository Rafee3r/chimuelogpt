import { describe, it, expect } from 'vitest';
import { extractUrlFromPrompt, scrapeUrlContent } from '../url-parser';

describe('extractUrlFromPrompt', () => {
  it('detecta URLs con esquema https o http', () => {
    expect(extractUrlFromPrompt('haz una landing para https://vada.cl')).toBe('https://vada.cl');
    expect(extractUrlFromPrompt('mira http://ejemplo.com/pagina')).toBe('http://ejemplo.com/pagina');
  });

  it('detecta dominios simples sin esquema y les antepone https', () => {
    expect(extractUrlFromPrompt('landing de vada.cl')).toBe('https://vada.cl');
    expect(extractUrlFromPrompt('replica www.vada.cl/catalogo')).toBe('https://www.vada.cl/catalogo');
    expect(extractUrlFromPrompt('crea la web de miempresa.store por favor')).toBe('https://miempresa.store');
  });

  it('limpia signos de puntuación pegados al final de la URL', () => {
    expect(extractUrlFromPrompt('mira vada.cl.')).toBe('https://vada.cl');
    expect(extractUrlFromPrompt('revisa https://vada.cl, con catálogo')).toBe('https://vada.cl');
  });

  it('devuelve null si no hay URLs en el prompt', () => {
    expect(extractUrlFromPrompt('haz un contador en HTML')).toBeNull();
    expect(extractUrlFromPrompt('hola mundo')).toBeNull();
    expect(extractUrlFromPrompt('')).toBeNull();
  });
});

describe('scrapeUrlContent', () => {
  it('falla limpiamente si no se proporciona URL', async () => {
    const res = await scrapeUrlContent('');
    expect(res.ok).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('extrae título y texto limpio eliminando scripts y estilos', async () => {
    const sampleHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>VADA Chile - Blanqueamiento Dental</title>
          <style>body { color: red; }</style>
        </head>
        <body>
          <script>console.log('secret');</script>
          <h1>Tiras de Blanqueamiento Dental</h1>
          <p>Resultados visibles sin peróxido por $29.900.</p>
        </body>
      </html>
    `;

    // Interceptar fetch temporalmente
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(sampleHtml, { status: 200, headers: { 'Content-Type': 'text/html' } });

    try {
      const res = await scrapeUrlContent('https://vada.cl');
      expect(res.ok).toBe(true);
      expect(res.title).toBe('VADA Chile - Blanqueamiento Dental');
      expect(res.text).toContain('Tiras de Blanqueamiento Dental');
      expect(res.text).toContain('sin peróxido por $29.900');
      expect(res.text).not.toContain('console.log');
      expect(res.text).not.toContain('body { color: red; }');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('readPage y extracción de paleta', () => {
  it('convierte rgb y normaliza hex adecuadamente', async () => {
    const { rgbToHex, normalizeHex } = await import('../url-parser');
    expect(rgbToHex(139, 68, 233)).toBe('#8b44e9');
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
    expect(normalizeHex('#FFF')).toBe('#ffffff');
    expect(normalizeHex('#8B44E9')).toBe('#8b44e9');
    expect(normalizeHex('invalido')).toBeNull();
  });

  it('extrae colores reales, background y cta desde styles y variables CSS', async () => {
    const { readPage } = await import('../url-parser');
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>VADA Chile</title>
          <style>
            :root {
              --color-base-accent-1: 139, 68, 233;
              --gradient-base-accent-1: #8b44e9;
              --gradient-base-background-1: #ffffff;
            }
            body { background: #ffffff; color: #121212; }
            .btn-cta { background-color: #8b44e9; color: #ffffff; }
            .badge { background: #6d388b; }
          </style>
        </head>
        <body>
          <h1>Tiras de Blanqueamiento</h1>
          <p>Resultados visibles sin dolor</p>
        </body>
      </html>
    `;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(mockHtml, { status: 200, headers: { 'Content-Type': 'text/html' } });

    try {
      const res = await readPage('https://vada.cl');
      expect(res.ok).toBe(true);
      expect(res.title).toBe('VADA Chile');
      expect(res.text).toContain('Tiras de Blanqueamiento');
      expect(res.background).toBe('#ffffff');
      expect(res.cta).toBe('#8b44e9');
      const hexList = res.colors.map(c => c.hex);
      expect(hexList).toContain('#8b44e9');
      expect(hexList).toContain('#6d388b');
      expect(hexList).not.toContain('#0ea5e9'); // Prohibido azul cielo
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('falla limpiamente si la URL es inválida', async () => {
    const { readPage } = await import('../url-parser');
    const res = await readPage('');
    expect(res.ok).toBe(false);
    expect(res.error).toBeDefined();
  });
});

