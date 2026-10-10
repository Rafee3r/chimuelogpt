import { describe, it, expect } from 'vitest';
import { parseChimuCodeCommand, CHIMUCODE_STARTER_SNIPPETS } from '../chimucode';

describe('parseChimuCodeCommand', () => {
  it('detecta comandos slash', () => {
    expect(parseChimuCodeCommand('/help')).toEqual({ isCommand: true, command: 'help' });
    expect(parseChimuCodeCommand('/clear')).toEqual({ isCommand: true, command: 'clear' });
    expect(parseChimuCodeCommand('/run')).toEqual({ isCommand: true, command: 'run' });
  });

  it('trata texto normal como código', () => {
    const res = parseChimuCodeCommand('console.log("hola")');
    expect(res.isCommand).toBe(false);
    expect(res.rawCode).toBe('console.log("hola")');
  });
});

describe('CHIMUCODE_STARTER_SNIPPETS', () => {
  it('incluye snippets válidos tanto para JS como Python', () => {
    expect(CHIMUCODE_STARTER_SNIPPETS.length).toBeGreaterThanOrEqual(3);
    const js = CHIMUCODE_STARTER_SNIPPETS.find(s => s.language === 'javascript');
    const py = CHIMUCODE_STARTER_SNIPPETS.find(s => s.language === 'python');
    expect(js).toBeDefined();
    expect(py).toBeDefined();
  });
});

describe('detectCodeLanguage', () => {
  it('detecta documentos HTML y tags', async () => {
    const { detectCodeLanguage } = await import('../chimucode');
    expect(detectCodeLanguage('<!DOCTYPE html><html><body><h1>Hola</h1></body></html>')).toBe('html');
    expect(detectCodeLanguage('<div class="app"><button>Click</button></div>')).toBe('html');
    expect(detectCodeLanguage('<canvas id="game"></canvas>')).toBe('html');
  });

  it('detecta scripts Python (lenguaje #1 de Claude)', async () => {
    const { detectCodeLanguage } = await import('../chimucode');
    expect(detectCodeLanguage('import math\nprint(math.sqrt(16))')).toBe('python');
    expect(detectCodeLanguage('def calcular_promedio(lista):\n    return sum(lista) / len(lista)')).toBe('python');
    expect(detectCodeLanguage('from statistics import mean\nprint(mean([1, 2, 3]))')).toBe('python');
  });

  it('detecta JavaScript/TypeScript (lenguaje #2 de Claude)', async () => {
    const { detectCodeLanguage } = await import('../chimucode');
    expect(detectCodeLanguage('const x = 10;\nconsole.log(x * 2);')).toBe('javascript');
    expect(detectCodeLanguage('function saludar() { return "hola"; }')).toBe('javascript');
  });

  it('detecta Swift/SwiftUI para apps nativas', async () => {
    const { detectCodeLanguage } = await import('../chimucode');
    expect(detectCodeLanguage('import SwiftUI\n\nstruct ContentView: View {\n    var body: some View {\n        Text("Hola")\n    }\n}')).toBe('swift');
  });
});

describe('extractCodeFromAiResponse', () => {
  it('extrae solo el interior del primer fence de html', async () => {
    const { extractCodeFromAiResponse } = await import('../chimucode');
    const input = 'Aquí tienes el contador:\n```html\n<div id="counter">0</div>\n<button>Sumar</button>\n```\nEspero que te sirva.';
    const res = extractCodeFromAiResponse(input);
    expect(res.language).toBe('html');
    expect(res.code).toBe('<div id="counter">0</div>\n<button>Sumar</button>');
  });

  it('extrae solo el interior de fences javascript y python', async () => {
    const { extractCodeFromAiResponse } = await import('../chimucode');
    const jsInput = '```javascript\nconsole.log("hola mundo");\n```';
    expect(extractCodeFromAiResponse(jsInput)).toEqual({
      code: 'console.log("hola mundo");',
      language: 'javascript',
    });

    const pyInput = '```python\nprint("test python")\n```';
    expect(extractCodeFromAiResponse(pyInput)).toEqual({
      code: 'print("test python")',
      language: 'python',
    });
  });

  it('devuelve código vacío si no hay fence y es solo texto conversacional', async () => {
    const { extractCodeFromAiResponse } = await import('../chimucode');
    const greeting = '¡Hola! ¿Qué aplicación o script te gustaría programar hoy?';
    const res = extractCodeFromAiResponse(greeting);
    expect(res.code).toBe('');
    expect(res.language).toBe('html');
  });

  it('devuelve documento HTML completo si no tiene fence pero tiene doctype y html', async () => {
    const { extractCodeFromAiResponse } = await import('../chimucode');
    const rawHtml = '<!DOCTYPE html><html><body><h1>Hola</h1></body></html>';
    const res = extractCodeFromAiResponse(rawHtml);
    expect(res.code).toBe(rawHtml);
    expect(res.language).toBe('html');
  });

  it('prioriza preview.html sobre fuentes nativos como swift', async () => {
    const { extractCodeFromAiResponse } = await import('../chimucode');
    const input = '```swift NotesApp.swift\nimport SwiftUI\n```\n\n```html preview.html\n<!DOCTYPE html><html><body><h1>Mockup Notas</h1></body></html>\n```';
    const res = extractCodeFromAiResponse(input);
    expect(res.language).toBe('html');
    expect(res.code).toContain('Mockup Notas');
  });
});

describe('extractProjectFilesFromAiResponse', () => {
  it('extrae múltiples archivos nombrados con rutas y carpetas', async () => {
    const { extractProjectFilesFromAiResponse } = await import('../chimucode');
    const response = `
Listo, aquí están los archivos:
\`\`\`html petra/index.html
<!DOCTYPE html><html><body><h1>Petra Inicio</h1><a href="catalogo.html">Ir al catálogo</a></body></html>
\`\`\`

\`\`\`html petra/catalogo.html
<!DOCTYPE html><html><body><h1>Catálogo</h1><a href="index.html">Volver</a></body></html>
\`\`\`

\`\`\`css petra/styles.css
body { background: #000; color: #fff; }
\`\`\`
¡Disfruta tu proyecto!`;

    const res = extractProjectFilesFromAiResponse(response, 'catálogo en otra página, en una carpeta petra');
    expect(res.files).toHaveLength(3);
    expect(res.files[0].path).toBe('petra/index.html');
    expect(res.files[0].language).toBe('html');
    expect(res.files[1].path).toBe('petra/catalogo.html');
    expect(res.files[1].language).toBe('html');
    expect(res.files[2].path).toBe('petra/styles.css');
    expect(res.files[2].language).toBe('css');
    expect(res.explanation).toContain('Listo, aquí están los archivos:');
    expect(res.explanation).not.toContain('```');
  });

  it('infiere la carpeta solicitada en el prompt si el fence no traía la carpeta', async () => {
    const { extractProjectFilesFromAiResponse } = await import('../chimucode');
    const response = `
\`\`\`html index.html
<h1>Principal</h1>
\`\`\`
\`\`\`html catalogo.html
<h1>Catálogo</h1>
\`\`\`
`;
    const res = extractProjectFilesFromAiResponse(response, 'en la carpeta tienda crea catalogo en otra página');
    expect(res.files.map(f => f.path)).toEqual(['tienda/index.html', 'tienda/catalogo.html']);
  });

  it('extrae fuentes Swift y preview.html juntos para pedidos de apps visuales', async () => {
    const { extractProjectFilesFromAiResponse } = await import('../chimucode');
    const response = `
\`\`\`swift NotesApp.swift
import SwiftUI
@main
struct NotesApp: App {
    var body: some Scene { WindowGroup { Text("Hola") } }
}
\`\`\`

\`\`\`html preview.html
<!DOCTYPE html><html><body><h1>Notas Mac</h1></body></html>
\`\`\`
`;
    const res = extractProjectFilesFromAiResponse(response, 'app de notas para mac');
    expect(res.files).toHaveLength(2);
    expect(res.files[0].path).toBe('NotesApp.swift');
    expect(res.files[0].language).toBe('swift');
    expect(res.files[1].path).toBe('preview.html');
    expect(res.files[1].language).toBe('html');
  });
});

describe('stripMarkdown', () => {
  it('elimina encabezados, negritas, cursivas y enlaces dejando texto plano', async () => {
    const { stripMarkdown } = await import('../chimucode');
    const md = '### Bienvenido a ChimuCode\nAquí tienes **negrita**, *cursiva* y un [enlace](https://vada.cl).';
    const plain = stripMarkdown(md);
    expect(plain).toBe('Bienvenido a ChimuCode\nAquí tienes negrita, cursiva y un enlace.');
  });

  it('elimina cercas de código dejando el contenido del bloque', async () => {
    const { stripMarkdown } = await import('../chimucode');
    const md = 'El código es:\n```html\n<h1>Hola</h1>\n```';
    const plain = stripMarkdown(md);
    expect(plain).toBe('El código es:\n<h1>Hola</h1>');
  });

  it('elimina viñetas, citas y separadores', async () => {
    const { stripMarkdown } = await import('../chimucode');
    const md = '> Esta es una cita\n\n- Opción A\n- Opción B\n\n---';
    const plain = stripMarkdown(md);
    expect(plain).toBe('Esta es una cita\n\nOpción A\nOpción B');
  });

  it('maneja strings vacíos o nulos limpiamente', async () => {
    const { stripMarkdown } = await import('../chimucode');
    expect(stripMarkdown('')).toBe('');
    expect(stripMarkdown(null as any)).toBe('');
  });
});



