import OpenAI from 'openai';
import { getToken } from '@vercel/connect';
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

    // Vercel Connect resolves the secret at runtime; never expose it to the browser.
    const apiKey = await getToken('gpt/rose-ladder', {
      subject: { type: 'app' },
    });

    if (!apiKey) {
      return NextResponse.json(
        { reply: 'AI ključ nije dostupan. Provjeri Vercel Connect vezu za ovaj projekt i okruženje.' },
        { status: 503 }
      );
    }

    const client = new OpenAI({ apiKey });
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
    // Do not log credentials or the token returned by Vercel Connect.
    console.error('EtoMe AI error:', error?.name || 'UnknownError');
    return NextResponse.json(
      { reply: 'AI se trenutačno ne može spojiti. Provjeri Vercel Connect i pokušaj ponovno.' },
      { status: 503 }
    );
  }
}
