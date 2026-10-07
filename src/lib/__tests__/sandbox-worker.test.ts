import { describe, it, expect } from 'vitest';
import { executeBrowserJS } from '../sandbox-worker';

describe('executeBrowserJS', () => {
  it('ejecuta código simple y captura console.log', async () => {
    const res = await executeBrowserJS('console.log("Hola desde ChimuCode");');
    expect(res.ok).toBe(true);
    expect(res.output).toContain('Hola desde ChimuCode');
    expect(res.engine).toBe('worker');
    expect(res.language).toBe('javascript');
  });

  it('retorna el valor resultante si no hay logs', async () => {
    const res = await executeBrowserJS('return 21 * 2;');
    expect(res.ok).toBe(true);
    expect(res.output).toBe('42');
  });

  it('captura errores de sintaxis o ejecución', async () => {
    const res = await executeBrowserJS('throw new Error("Fallo de prueba");');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('Fallo de prueba');
  });

  it('formatea objetos en JSON adecuadamente', async () => {
    const res = await executeBrowserJS('console.log({ nombre: "Chimuelo", version: 2 });');
    expect(res.ok).toBe(true);
    expect(res.output).toContain('"nombre": "Chimuelo"');
  });
});
