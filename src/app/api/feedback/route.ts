import { parsearFeedback, textoNotificacion } from '../../../lib/feedback';

export const maxDuration = 15;

const recent = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const hits = (recent.get(ip) || []).filter(t => now - t < windowMs);
  if (hits.length >= 12) {
    recent.set(ip, hits);
    return true;
  }
  hits.push(now);
  recent.set(ip, hits);
  return false;
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    if (rateLimited(ip)) {
      return Response.json({ error: 'Mandaste muchos comentarios. Prueba en un rato.' }, { status: 429 });
    }

    const parsed = parsearFeedback(await req.json().catch(() => ({})));
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    const { data } = parsed;
    const { title, body } = textoNotificacion(data);
    console.log('CHIMUELO_FEEDBACK', JSON.stringify({ ...data, at: new Date().toISOString() }));

    /* Likes no se notifican: harían ruido. Dislike y comentario sí. */
    if (data.type !== 'like') {
      const topic = (process.env.NTFY_TOPIC || 'chimuelo-casa-feedback').replace(/[^a-zA-Z0-9_-]/g, '');
      await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        headers: {
          Title: title,
          Tags: data.type === 'dislike' ? 'thumbsdown' : 'speech_balloon',
        },
        body,
      }).catch(() => {});

      const webhook = process.env.FEEDBACK_WEBHOOK;
      if (webhook) {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, at: new Date().toISOString() }),
        }).catch(() => {});
      }
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'No pude enviar el comentario.' }, { status: 500 });
  }
}
