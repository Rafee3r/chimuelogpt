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

    const systemPrompt = `Eres el motor de sugerencias de Chimuelo, un asistente de IA personal y empático.
Tu trabajo: generar 4 sugerencias de acciones PERSONALIZADAS que el usuario probablemente quiera ahora mismo.

CONTEXTO DEL USUARIO:
- Hora del día: ${timeOfDay}
- Títulos de chats recientes: \n${chatsStr}
- Datos personales conocidos: \n${memoryStr}
- Personalidad de Chimuelo: ${persona || 'default'}

CÓMO PIENSAS LAS SUGERENCIAS:
1. Si el usuario tiene chats recientes sobre temas X/Y, ofrece continuaciones naturales sobre esos temas
2. Si sabes que estudia X, trabaja en Y o tiene metas Z, sugiere algo útil relacionado
3. Considera la hora: por la mañana → planear el día; tarde → resolver pendientes; noche → reflexionar/aprender algo nuevo
4. Las sugerencias deben ser ESPECÍFICAS para ESTE usuario, no genéricas
5. Si no hay contexto, sugiere acciones útiles cotidianas (planificación, aprendizaje, productividad)

REGLAS DE FORMATO ESTRICTAS:
- Devuelve SOLO un JSON array con EXACTAMENTE 4 objetos, sin texto antes ni después
- Cada objeto: {"icon":"emoji","label":"2-3 palabras","message":"frase imperativa en español lista para enviar"}
- El "message" es un mensaje concreto, NO un placeholder ni una pregunta vacía
- Los 4 emojis deben ser distintos entre sí
- RESPONDE SOLO con el JSON array, sin markdown ni explicación

Ejemplo de FORMATO (no de contenido):
[{"icon":"🌅","label":"Plan del día","message":"Ayúdame a armar un plan para hoy con bloques de tiempo"},{"icon":"📚","label":"Resumir tema","message":"Resume el último tema que estudié en bullets cortos"},{"icon":"💡","label":"Idea creativa","message":"Dame 3 ideas creativas para mi proyecto actual"},{"icon":"☕","label":"Pausa mental","message":"Sugiere una pausa corta para despejar la mente"}]`;

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: systemPrompt }],
        max_tokens: 500,
        temperature: 0.85,
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
