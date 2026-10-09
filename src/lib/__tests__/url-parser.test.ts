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
