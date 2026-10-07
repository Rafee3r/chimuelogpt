import type { SandboxResult } from './sandbox-types';

/**
 * Ejecuta código JavaScript de forma aislada en el cliente (navegador).
 * Captura console.log, console.warn, console.error y el valor retornado.
 */
export async function executeBrowserJS(code: string, timeoutMs = 4000): Promise<SandboxResult> {
  const start = Date.now();
  const logs: string[] = [];

  // Verificamos si estamos en un entorno con soporte a Web Workers
  const hasWorkerSupport = typeof window !== 'undefined' && typeof window.Worker !== 'undefined' && typeof window.Blob !== 'undefined';

  if (!hasWorkerSupport) {
    // Modo fallback seguro (entorno Node/SSR o Vitest)
    try {
      const sandboxConsole = {
        log: (...args: any[]) => logs.push(args.map(a => formatArg(a)).join(' ')),
        warn: (...args: any[]) => logs.push('[WARN] ' + args.map(a => formatArg(a)).join(' ')),
        error: (...args: any[]) => logs.push('[ERROR] ' + args.map(a => formatArg(a)).join(' ')),
      };

      // Ejecución con Function aislada de variables globales
      const fn = new Function('console', `"use strict";\n${code}`);
      const result = fn(sandboxConsole);

      if (result !== undefined && logs.length === 0) {
        logs.push(formatArg(result));
      }

      return {
        ok: true,
        output: logs.join('\n') || '(Código ejecutado sin salida)',
        durationMs: Date.now() - start,
        engine: 'worker',
        language: 'javascript',
      };
    } catch (err: any) {
      return {
        ok: false,
        output: logs.join('\n'),
        error: err?.message || String(err),
        durationMs: Date.now() - start,
        engine: 'worker',
        language: 'javascript',
      };
    }
  }

  // Código que correrá dentro del Web Worker aislado
  const workerScript = `
    self.onmessage = function(e) {
      const code = e.data.code;
      const logs = [];
      const customConsole = {
        log: function(...args) {
          logs.push(args.map(function(a) {
            try { return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); }
            catch(e) { return String(a); }
          }).join(' '));
        },
        warn: function(...args) {
          logs.push('[WARN] ' + args.map(String).join(' '));
        },
        error: function(...args) {
          logs.push('[ERROR] ' + args.map(String).join(' '));
        }
      };

      try {
        const runFn = new Function('console', '"use strict";\\n' + code);
        const res = runFn(customConsole);
        if (res !== undefined && logs.length === 0) {
          logs.push(typeof res === 'object' ? JSON.stringify(res, null, 2) : String(res));
        }
        self.postMessage({ ok: true, output: logs.join('\\n'), durationMs: 0 });
      } catch (err) {
        self.postMessage({ ok: false, output: logs.join('\\n'), error: err.message || String(err) });
      }
    };
  `;

  return new Promise<SandboxResult>((resolve) => {
    let worker: Worker | null = null;
    let timer: any = null;

    try {
      const blob = new Blob([workerScript], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      worker = new Worker(workerUrl);

      timer = setTimeout(() => {
        if (worker) {
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
        }
        resolve({
          ok: false,
          output: logs.join('\n'),
          error: `Tiempo de ejecución excedido (Timeout de ${timeoutMs}ms)`,
          durationMs: Date.now() - start,
          engine: 'worker',
          language: 'javascript',
        });
      }, timeoutMs);

      worker.onmessage = (event) => {
        clearTimeout(timer);
        if (worker) {
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
        }
        const data = event.data;
        resolve({
          ok: data.ok,
          output: data.output || '(Código ejecutado sin salida)',
          error: data.error,
          durationMs: Date.now() - start,
          engine: 'worker',
          language: 'javascript',
        });
      };

      worker.onerror = (err) => {
        clearTimeout(timer);
        if (worker) {
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
        }
        resolve({
          ok: false,
          output: logs.join('\n'),
          error: err.message || 'Error en Web Worker',
          durationMs: Date.now() - start,
          engine: 'worker',
          language: 'javascript',
        });
      };

      worker.postMessage({ code });
    } catch (e: any) {
      if (timer) clearTimeout(timer);
      resolve({
        ok: false,
        output: '',
        error: e?.message || 'No se pudo iniciar el Web Worker',
        durationMs: Date.now() - start,
        engine: 'worker',
        language: 'javascript',
      });
    }
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
