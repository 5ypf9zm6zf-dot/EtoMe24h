import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_REQUEST_BYTES = 64 * 1024;

export async function POST(request) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json(
        { reply: 'Poruka je prevelika. Skrati je pa pokušaj ponovno.' },
        { status: 413 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { reply: 'Poruka nije ispravna. Pokušaj ponovno.' },
        { status: 400 }
      );
    }

    const messages = Array.isArray(body?.messages) ? body.messages : [];

    if (messages.length === 0 || messages.length > MAX_MESSAGES) {
      return NextResponse.json({ reply: 'Pošalji poruku pa pokušaj ponovno.' }, { status: 400 });
    }

    const safeMessages = messages
      .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
      .slice(-MAX_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_MESSAGE_LENGTH) }))
      .filter((m) => m.content.length > 0);

    if (safeMessages.length === 0) {
      return NextResponse.json({ reply: 'Nisam dobio valjanu poruku.' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('EtoMe AI unavailable: OPENAI_API_KEY is not configured.');
      return NextResponse.json(
        { reply: 'AI trenutno nije dostupan. Nazovi nas na 098 1947 591 ili nam pošalji WhatsApp poruku.' },
        { status: 503 }
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      instructions:
        'Ti si EtoMe AI asistent. Odgovaraj na hrvatskom, jasno, kratko i korisno. Pomaži korisnicima oko EtoMe usluga i općih pitanja. Ne izmišljaj cijene, termine ili dostupnost.',
      input: safeMessages,
      max_output_tokens: 400,
    });

    return NextResponse.json({
      reply: response.output_text || 'Trenutno nemam odgovor. Pokušaj ponovno.',
    });
  } catch (error) {
    console.error('EtoMe AI error:', error);
    return NextResponse.json(
      { reply: 'Došlo je do greške. Pokušaj ponovno.' },
      { status: 500 }
    );
  }
}
