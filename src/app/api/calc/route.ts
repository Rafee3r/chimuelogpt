import { NextResponse } from 'next/server';
import { calculate } from '../../../lib/calculator';

export const maxDuration = 10;

/* Cálculo exacto. La evaluación es local y determinista (sin eval ni red),
   así que responde en milisegundos y nunca se equivoca en aritmética. */
export async function POST(req: Request) {
  try {
    const { expression } = await req.json();
    if (typeof expression !== 'string') {
      return NextResponse.json({ ok: false, error: 'Falta la expresión' }, { status: 400 });
    }
    return NextResponse.json(calculate(expression));
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida' }, { status: 400 });
  }
}
