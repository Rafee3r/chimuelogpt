export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { userMessage, assistantMessage, existingMemories } = await req.json();
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ facts: [] }), { status: 200 });

    const existingStr = existingMemories?.length
      ? existingMemories.map((m: string, i: number) => `${i + 1}. ${m}`).join('\n')
      : '(ninguna)';

    const systemPrompt = `Eres un extractor de datos. Tu única función es extraer hechos personales NUEVOS sobre el USUARIO de un intercambio de chat.

YA MEMORIZADO (NO repetir):
${existingStr}

REGLAS ESTRICTAS:
- Solo hechos sobre el usuario (nombre, edad, país, familia, estudios, trabajo, gustos, problemas personales, metas)
- Ignora hechos sobre temas generales o la IA
- Máximo 3 hechos nuevos, mínimo 0
- Cada hecho: máximo 20 palabras, en español, tercera persona ("El usuario se llama...", "Tiene 18 años...", "Estudia ingeniería...")
- Si nada es nuevo o personal, devuelve array vacío
- RESPONDE SOLO con JSON array de strings, sin explicación ni markdown`;

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `INTERCAMBIO:\nUsuario: ${userMessage?.slice(0, 800) || ''}\nIA: ${assistantMessage?.slice(0, 800) || ''}`,
          },
        ],
        max_tokens: 200,
        temperature: 0.1,
      }),
    });

    if (!res.ok) return new Response(JSON.stringify({ facts: [] }), { status: 200 });

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '[]';

    let facts: string[] = [];
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      facts = match ? JSON.parse(match[0]) : [];
      if (!Array.isArray(facts)) facts = [];
      facts = facts.filter((f: unknown) => typeof f === 'string' && f.trim().length > 0).slice(0, 3);
    } catch {
      facts = [];
    }

    return new Response(JSON.stringify({ facts }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ facts: [] }), { status: 200 });
  }
}
