# EtoMe24h

EtoMe 24h web stranica s ugrađenim AI asistentom.

## Stack

- Next.js
- React
- OpenAI API
- Vercel

## Lokalno pokretanje

```bash
npm install
npm run dev
```

Otvori `http://localhost:3000`.

## OpenAI API ključ

Kreiraj `.env.local` u korijenu projekta:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5-mini
```

**Nikad ne stavljaj stvarni API ključ u GitHub kod niti u varijablu koja počinje s `NEXT_PUBLIC_`.**

## Vercel deploy

1. Importiraj GitHub repozitorij `5ypf9zm6zf-dot/EtoMe24h` u Vercel.
2. Ostavi framework na Next.js i root directory na `/`.
3. U **Settings → Environment Variables** dodaj `OPENAI_API_KEY` za Production (i Preview/Development ako želiš).
4. Po želji dodaj `OPENAI_MODEL=gpt-5-mini`.
5. Deploy / Redeploy.

Nakon dodavanja ili promjene environment varijabli potrebno je napraviti novi deployment.

## Struktura

- `app/page.js` — početna stranica i AI chat
- `app/api/chat/route.js` — server-side OpenAI endpoint
- `app/layout.js` — metadata i osnovni layout
- `vercel.json` — Vercel konfiguracija
- `.env.example` — primjer environment varijabli
- `.gitignore` — zaštita lokalnih tajni i build datoteka
