import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { messages = [] } = await request.json();
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ reply: 'AI nije još spojen — dodaj OPENAI_API_KEY u Vercel Environment Variables.' }, { status: 503 });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      instructions: 'Ti si EtoMe AI asistent. Odgovaraj na hrvatskom, jasno, kratko i korisno. Pomaži korisnicima oko EtoMe usluga i općih pitanja. Ne izmišljaj cijene, termine ili dostupnost.',
      input: messages.map(m => ({ role: m.role, content: m.content }))
    });
    return NextResponse.json({ reply: response.output_text });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ reply: 'Došlo je do greške. Pokušaj ponovno.' }, { status: 500 });
  }
}
