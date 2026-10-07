import { describe, it, expect } from 'vitest';
import { executeNodeVM, executePythonProcess, validateSafeCode } from '../sandbox-cloud';

describe('validateSafeCode', () => {
  it('rechaza código vacío', () => {
    expect(validateSafeCode('', 'javascript').safe).toBe(false);
  });

  it('bloquea patrones destructivos como rm -rf /', () => {
    expect(validateSafeCode('rm -rf /', 'javascript').safe).toBe(false);
  });

  it('permite código legítimo', () => {
    expect(validateSafeCode('console.log("ok");', 'javascript').safe).toBe(true);
  });
});

describe('executeNodeVM', () => {
  it('ejecuta código en el VM y captura logs', async () => {
    const res = await executeNodeVM('console.log(10 + 20);');
    expect(res.ok).toBe(true);
    expect(res.output).toContain('30');
    expect(res.engine).toBe('cloud');
  });

  it('captura errores adecuadamente', async () => {
    const res = await executeNodeVM('foo.bar()');
    expect(res.ok).toBe(false);
    expect(res.error).toBeDefined();
  });
});

describe('executePythonProcess', () => {
  it('ejecuta un print de Python', async () => {
    const res = await executePythonProcess('print(40 + 2)');
    expect(res.ok).toBe(true);
    expect(res.output).toContain('42');
  });
});
