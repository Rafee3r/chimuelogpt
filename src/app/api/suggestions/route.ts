export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { recentChats, memoryFacts, hour, persona } = await req.json();
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ suggestions: null }), { status: 200 });

    const timeOfDay = hour < 12 ? 'mañana' : hour < 19 ? 'tarde' : 'noche';
    const chatsStr = recentChats?.length
      ? recentChats.slice(0, 6).map((t: string) => `- ${t}`).join('\n')
      : '(ninguno)';
    const memoryStr = memoryFacts?.length
      ? memoryFacts.slice(0, 5).map((f: string) => `- ${f}`).join('\n')
      : '(ninguna)';

    const systemPrompt = `Eres un motor de sugerencias inteligente para un asistente de IA llamado Chimuelo.
Tu única función es generar 4 sugerencias de acciones personalizadas para el usuario.

CONTEXTO DEL USUARIO:
- Hora del día: ${timeOfDay}
- Chats recientes: \n${chatsStr}
- Lo que sabes del usuario: \n${memoryStr}
- Personalidad del asistente: ${persona || 'default'}

REGLAS ESTRICTAS:
- Devuelve SOLO un JSON array con exactamente 4 objetos
- Cada objeto: {"icon":"emoji","label":"máx 3 palabras","message":"mensaje completo listo para enviar en español"}
- Las sugerencias deben ser variadas, útiles y relevantes al contexto del usuario
- El "message" debe ser una instrucción concreta lista para enviar (no un placeholder)
- Si no hay contexto suficiente, usa sugerencias generales útiles
- RESPONDE SOLO con el JSON array, sin explicación ni markdown`;

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-pro',
        messages: [{ role: 'user', content: systemPrompt }],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!res.ok) return new Response(JSON.stringify({ suggestions: null }), { status: 200 });

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '[]';

    let suggestions = null;
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      const parsed = match ? JSON.parse(match[0]) : [];
      if (Array.isArray(parsed) && parsed.length === 4) {
        suggestions = parsed.filter(
          (s: any) => s && typeof s.icon === 'string' && typeof s.label === 'string' && typeof s.message === 'string'
        );
        if (suggestions.length !== 4) suggestions = null;
      }
    } catch {
      suggestions = null;
    }

    return new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ suggestions: null }), { status: 200 });
  }
}
