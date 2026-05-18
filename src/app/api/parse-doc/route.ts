export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No se recibió archivo.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const name = file.name.toLowerCase();

    let text = '';

    if (name.endsWith('.pdf')) {
      const { extractText } = await import('unpdf');
      const { text: extracted } = await extractText(new Uint8Array(buffer), { mergePages: true });
      text = extracted;
    } else if (name.endsWith('.docx')) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv')) {
      text = buffer.toString('utf-8');
    } else {
      return new Response(JSON.stringify({ error: 'Formato no soportado. Usa PDF, Word (.docx) o TXT.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    text = text.trim();

    return new Response(JSON.stringify({ text }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Parse doc error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Error al procesar el documento.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
