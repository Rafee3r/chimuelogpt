import { extractCodeFromAiResponse } from '../../../../lib/chimucode';

export const maxDuration = 45;

export async function POST(req: Request) {
  try {
    const { prompt, currentCode, language = 'html' } = await req.json().catch(() => ({}));

    if (!prompt || typeof prompt !== 'string') {
      return Response.json({ ok: false, error: 'Debes proporcionar una instrucción para ChimuCode.' }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ ok: false, error: 'API key no configurada en el servidor.' }, { status: 500 });
    }

    const isOpenAi = !process.env.DEEPSEEK_API_KEY && !!process.env.OPENAI_API_KEY;
    const apiEndpoint = isOpenAi ? 'https://api.openai.com/v1/chat/completions' : 'https://api.deepseek.com/chat/completions';
    const apiModel = isOpenAi ? 'gpt-4o-mini' : 'deepseek-chat';

    const systemPrompt = `Eres ChimuCode, un sistema multiagente de desarrollo de software (Codex / Canvas / Artifacts) de élite.
Tu misión es diseñar, programar y auditar aplicaciones web completas ("Vibe Coding") que funcionen de inmediato.

ROLES QUE EJECUTAS SIMULTÁNEAMENTE:
1. [ARQUITECTO UX/UI]: Diseñas la interfaz con estándares modernos (Tailwind CSS vía CDN, animaciones fluidas, paletas oscuras o glassmorphism, responsive).
2. [PROGRAMADOR FULLSTACK]: Escribes código 100% completo, autosuficiente y funcional. NUNCA dejes "// TODO", ni funciones a medias, ni "agrega tu lógica aquí". Todo debe funcionar al hacer clic.
3. [QA & AUDITOR]: Garantizas que los scripts no arrojen errores de JavaScript, que el HTML sea válido y que todas las dependencias usen CDNs confiables (ej. Tailwind CDN, Canvas, FontAwesome).

REGLAS CRÍTICAS DE RESPUESTA:
- Si el usuario pide una aplicación, juego, widget o UI, devuelve un documento HTML5 completo y autocontenido con <!DOCTYPE html>, <head>, <style> o script de Tailwind, y <script> con toda la lógica interactiva.
- Devuelve el código dentro de un bloque markdown \`\`\`html ... \`\`\` o el lenguaje correspondiente.
- Puedes incluir una breve explicación de 1 o 2 líneas antes o después del bloque de código.
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

    return Response.json({
      ok: true,
      code: extracted.code,
      language: extracted.language || language,
      rawExplanation: aiText.replace(/```[\s\S]*?```/g, '').trim(),
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
