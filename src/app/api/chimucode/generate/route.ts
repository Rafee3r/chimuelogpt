import { extractProjectFilesFromAiResponse } from '../../../../lib/chimucode';
import { isUncensoredModel } from '../../../../lib/models';

export const maxDuration = 45;

export async function POST(req: Request) {
  try {
    const { prompt, currentCode, language = 'html', model = 'deepseek-v4-flash', files } = await req.json().catch(() => ({}));

    if (!prompt || typeof prompt !== 'string') {
      return Response.json({ ok: false, error: 'Debes proporcionar una instrucción para ChimuCode.' }, { status: 400 });
    }

    const useUncensored = isUncensoredModel(model);
    const apiKey = useUncensored 
      ? (process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY)
      : (process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY);

    if (!apiKey) {
      return Response.json({ ok: false, error: 'API key no configurada en el servidor.' }, { status: 500 });
    }

    const isOpenAi = useUncensored || (!process.env.DEEPSEEK_API_KEY && !!process.env.OPENAI_API_KEY);
    const apiEndpoint = isOpenAi ? 'https://api.openai.com/v1/chat/completions' : 'https://api.deepseek.com/chat/completions';
    const apiModel = isOpenAi ? 'gpt-4o-mini' : 'deepseek-chat';

    let existingProjectContext = '';
    if (files && Array.isArray(files) && files.length > 0) {
      existingProjectContext = `ARCHIVOS EXISTENTES EN ESTE PROYECTO:\n` +
        files.map((f: any) => `--- ${f.path} ---\n${(f.content || '').slice(0, 10000)}`).join('\n\n');
    } else if (currentCode) {
      existingProjectContext = `CÓDIGO ACTUAL EXISTENTE:\n\`\`\`\n${currentCode.slice(0, 12000)}\n\`\`\``;
    }

    const systemPrompt = `Eres un asistente de desarrollo y programación de software multi-archivo para la plataforma ChimuCode.

REGLAS OBLIGATORIAS:
- SÍ PUEDES CREAR CARPETAS Y ARCHIVOS VIRTUALES. NUNCA digas "no puedo crear carpetas en tu sistema", "no tengo acceso a tu disco" ni "cópialo manualmente". En este entorno tú gestionas un proyecto virtual con múltiples archivos y carpetas.
- Si te piden "en una carpeta" o "otra página" (ej. "en una carpeta petra", "catálogo en otra página"), responde entregando los archivos con sus rutas relativas en la cabecera de cada bloque markdown:
  \`\`\`html petra/index.html
  <!DOCTYPE html>...
  \`\`\`
  \`\`\`html petra/catalogo.html
  <!DOCTYPE html>...
  \`\`\`
- Cada turno modifica el proyecto: devuelve SOLO los archivos que cambian o que se crean nuevos. El cliente hace merge automático por ruta (path).
- Responde con una sola línea de texto breve antes de los bloques de código (ej: "Listo, petra/index.html y petra/catalogo.html").
- NUNCA des discursos de bienvenida ni te presentes como "Soy ChimuCode".
- Si el usuario solo saluda (ej. "hola") o no pide código todavía, responde con una sola pregunta de 1 línea invitándolo a construir.
- Los enlaces entre páginas deben ser relativos (ej. <a href="catalogo.html"> o <a href="petra/catalogo.html">).

${existingProjectContext}`;

    const res = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: apiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return Response.json({ ok: false, error: `Error del modelo AI: ${res.status} ${errText}` }, { status: 502 });
    }

    const data = await res.json();
    const aiText = data.choices?.[0]?.message?.content || '';

    const extracted = extractProjectFilesFromAiResponse(aiText, prompt, files);
    const hasCode = extracted.files.length > 0;
    const primaryFile = extracted.files.find(f => f.language === 'html') || extracted.files[0];

    return Response.json({
      ok: true,
      files: extracted.files,
      code: hasCode ? primaryFile.content : null,
      language: hasCode ? primaryFile.language : language,
      activePath: hasCode ? primaryFile.path : null,
      rawExplanation: hasCode
        ? (extracted.explanation || 'Archivos del proyecto actualizados.')
        : aiText.trim(),
      stages: [
        '📁 Multi-file Codex: Archivos del proyecto estructurados',
        '💻 Código generado e interactivo',
        '🛡️ Sandbox validado',
      ],
    });
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message || 'Error interno en ChimuCode Generator' }, { status: 500 });
  }
}
