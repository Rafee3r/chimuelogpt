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
});

