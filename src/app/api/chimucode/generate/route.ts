import { extractCodeFromAiResponse } from '../../../../lib/chimucode';
import { isUncensoredModel } from '../../../../lib/models';

export const maxDuration = 45;

export async function POST(req: Request) {
  try {
    const { prompt, currentCode, language = 'html', model = 'deepseek-v4-flash' } = await req.json().catch(() => ({}));

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

    const systemPrompt = `Eres un asistente de programación técnico, directo y conciso.
REGLAS OBLIGATORIAS:
- NUNCA des discursos de bienvenida. Prohibido decir "Soy ChimuCode", "tu sistema multiagente", o presentarte.
- Si el usuario solo saluda (ej. "hola") o aún no pide código específico, responde ÚNICAMENTE con una sola pregunta o frase breve de 1 línea invitándolo a construir (ej. "¿Qué aplicación o script te gustaría programar?").
- Si el usuario pide una aplicación, juego, widget o UI, devuelve un documento HTML5 completo y autocontenido con <!DOCTYPE html>, <head>, <style> (o CDN de Tailwind) y <script> interactivo funcional.
- Entrega el código dentro de un solo bloque markdown \`\`\`html ... \`\`\` o el lenguaje solicitado.
- Toda explicación antes o después del código debe ser de máximo 1 línea o bullets ultracortos.
${currentCode ? `CÓDIGO ACTUAL EXISTENTE PARA MODIFICAR/MEJORAR:\n\`\`\`\n${currentCode.slice(0, 15000)}\n\`\`\`` : ''}`;

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

    const extracted = extractCodeFromAiResponse(aiText);
    const hasCode = !!extracted.code && extracted.code.trim().length > 0;

    return Response.json({
      ok: true,
      code: hasCode ? extracted.code : null,
      language: hasCode ? extracted.language : language,
      rawExplanation: hasCode
        ? aiText.replace(/```[\s\S]*?```/g, '').trim() || 'Aquí tienes el código solicitado:'
        : aiText.trim(),
      stages: [
        '📐 Arquitecto: Estructura y dependencias planificadas',
        '💻 Codex: Código completo e interactivo generado',
        '🛡️ QA: Sintaxis y compatibilidad de sandbox auditadas',
      ],
    });
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message || 'Error interno en ChimuCode Generator' }, { status: 500 });
  }
}
