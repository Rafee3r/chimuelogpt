import { executeNodeVM, executePythonProcess } from '../../../lib/sandbox-cloud';
import type { SandboxLanguage } from '../../../lib/sandbox-types';

export const maxDuration = 15;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { code, language = 'javascript' } = body as { code?: string; language?: SandboxLanguage };

    if (!code || typeof code !== 'string') {
      return Response.json({ ok: false, error: 'Código no proporcionado o inválido' }, { status: 400 });
    }

    if (language === 'python') {
      const result = await executePythonProcess(code);
      return Response.json(result);
    }

    // Default: JavaScript en VM segura de Node.js
    const result = await executeNodeVM(code);
    return Response.json(result);
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message || 'Error inesperado en el servidor sandbox' },
      { status: 500 }
    );
  }
}
