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
