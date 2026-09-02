import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;

export async function POST(request) {
  try {
    const body = await request.json();
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
      return NextResponse.json(
        { reply: 'AI nije još spojen — dodaj OPENAI_API_KEY u Vercel Environment Variables.' },
        { status: 503 }
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      instructions:
        'Ti si EtoMe AI asistent. Odgovaraj na hrvatskom, jasno, kratko i korisno. Pomaži korisnicima oko EtoMe usluga i općih pitanja. Ne izmišljaj cijene, termine ili dostupnost.',
      input: safeMessages,
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
