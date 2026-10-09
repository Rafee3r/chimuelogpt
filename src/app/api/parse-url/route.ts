import { NextResponse } from 'next/server';
import { scrapeUrlContent } from '../../../lib/url-parser';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { url } = await req.json().catch(() => ({}));
    if (!url) {
      return NextResponse.json({ error: 'URL requerida.' }, { status: 400 });
    }

    const result = await scrapeUrlContent(url);
    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Error al acceder a la URL.' }, { status: 500 });
    }

    return NextResponse.json({
      title: result.title || 'Contenido de la página',
      text: result.text || '',
    });
  } catch (error: any) {
    console.error('Parse URL API Error:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
