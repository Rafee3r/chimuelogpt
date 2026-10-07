import { execFile } from 'node:child_process';
import vm from 'node:vm';
import type { SandboxLanguage, SandboxResult } from './sandbox-types';

/**
 * Valida patrones de código manifiestamente peligrosos antes de enviar al sandbox.
 */
export function validateSafeCode(code: string, language: SandboxLanguage): { safe: boolean; reason?: string } {
  if (!code || !code.trim()) {
    return { safe: false, reason: 'El código está vacío.' };
  }

  if (code.length > 50000) {
    return { safe: false, reason: 'El código excede el límite de tamaño permitido (50KB).' };
  }

  // Bloqueos de patrones destructivos obvios
  const blockedPatterns = [
    /rm\s+-rf\s+[\/~]/i,
    /:(){ :\|:& };:/, // Fork bomb
    /process\.env\.(DEEPSEEK_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|VERCEL)/,
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(code)) {
      return { safe: false, reason: 'El código contiene instrucciones bloqueadas por seguridad.' };
    }
  }

  return { safe: true };
}

/**
 * Ejecuta código JavaScript/TypeScript en el backend utilizando el módulo aislado `vm` de Node.js.
 */
export async function executeNodeVM(code: string, timeoutMs = 4000): Promise<SandboxResult> {
  const start = Date.now();
  const logs: string[] = [];

  const validation = validateSafeCode(code, 'javascript');
  if (!validation.safe) {
    return {
      ok: false,
      output: '',
      error: validation.reason,
      durationMs: 0,
      engine: 'cloud',
      language: 'javascript',
    };
  }

  try {
    const sandboxConsole = {
      log: (...args: any[]) => logs.push(args.map(formatArg).join(' ')),
      warn: (...args: any[]) => logs.push('[WARN] ' + args.map(formatArg).join(' ')),
      error: (...args: any[]) => logs.push('[ERROR] ' + args.map(formatArg).join(' ')),
      info: (...args: any[]) => logs.push(args.map(formatArg).join(' ')),
    };

    const sandbox = {
      console: sandboxConsole,
      setTimeout: undefined,
      setInterval: undefined,
      setImmediate: undefined,
      fetch: undefined,
      process: { env: {} },
      Buffer: undefined,
    };

    const context = vm.createContext(sandbox);
    const script = new vm.Script(`
      (function() {
        "use strict";
        ${code}
      })()
    `);

    const result = script.runInContext(context, {
      timeout: timeoutMs,
      displayErrors: true,
    });

    if (result !== undefined && logs.length === 0) {
      logs.push(formatArg(result));
    }

    return {
      ok: true,
      output: logs.join('\n') || '(Ejecución completada sin salida en consola)',
      durationMs: Date.now() - start,
      engine: 'cloud',
      language: 'javascript',
    };
  } catch (err: any) {
    return {
      ok: false,
      output: logs.join('\n'),
      error: err?.message || String(err),
      durationMs: Date.now() - start,
      engine: 'cloud',
      language: 'javascript',
    };
  }
}

/**
 * Ejecuta código Python en el backend mediante un subproceso aislado con timeout.
 */
export async function executePythonProcess(code: string, timeoutMs = 5000): Promise<SandboxResult> {
  const start = Date.now();

  const validation = validateSafeCode(code, 'python');
  if (!validation.safe) {
    return {
      ok: false,
      output: '',
      error: validation.reason,
      durationMs: 0,
      engine: 'cloud',
      language: 'python',
    };
  }

  return new Promise<SandboxResult>((resolve) => {
    execFile(
      'python3',
      ['-c', code],
      {
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024, // 1MB output cap
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      },
      (error, stdout, stderr) => {
        const durationMs = Date.now() - start;
        const out = (stdout || '').trim();
        const err = (stderr || '').trim();

        if (error) {
          const isTimeout = error.killed || error.signal === 'SIGTERM';
          return resolve({
            ok: false,
            output: out,
            error: isTimeout ? `Timeout excedido (${timeoutMs}ms)` : err || error.message,
            durationMs,
            engine: 'cloud',
            language: 'python',
          });
        }

        resolve({
          ok: true,
          output: out || err || '(Ejecución completada sin salida)',
          error: err ? `Advertencias:\n${err}` : undefined,
          durationMs,
          engine: 'cloud',
          language: 'python',
        });
      }
    );
  });
}

function formatArg(arg: any): string {
  if (typeof arg === 'object' && arg !== null) {
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}
