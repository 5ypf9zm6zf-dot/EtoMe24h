# EtoMe24h

EtoMe 24h web stranica s ugrađenim AI asistentom.

## Stack

- Next.js
- React
- OpenAI API (default AI provider)
- Vercel

## Lokalno pokretanje

```bash
npm ci
npm run dev
```

Otvori `http://localhost:3000`.

## OpenAI API ključ

Kreiraj `.env.local` u korijenu projekta:

```env
OPENAI_API_KEY=your_key_here
AI_PROVIDER=openai
OPENAI_MODEL=gpt-5-mini
```

**Nikad ne stavljaj stvarni API ključ u GitHub kod niti u varijablu koja počinje s `NEXT_PUBLIC_`.**

`AI_PROVIDER` defaults to `openai`. Gemini is optional and is used only when
`AI_PROVIDER=gemini` and a valid `GEMINI_API_KEY` are explicitly configured.
There is no automatic provider fallback.

## Vercel deploy

1. Importiraj GitHub repozitorij `5ypf9zm6zf-dot/EtoMe24h` u Vercel.
2. Ostavi framework na Next.js i root directory na `/`.
3. U projektu otvori **Environment Variables** u sidebaru i dodaj `OPENAI_API_KEY` kao **Secret** za Production (i Preview/Development po potrebi).
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

## Sigurnost chata

`npm test` provjerava ugovor API-ja s lažnim providerom (nije test stvarnog OpenAI ključa).
Za Production su obvezni `OPENAI_API_KEY` i potpuni Redis REST par:
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` ili Marketplace
`KV_REST_API_URL` / `KV_REST_API_TOKEN`. Izravni Upstash par ima prednost;
parovi se nikad ne miješaju. Preview i Production imaju odvojene brojače po projektu.
Siguran postupak zamjene tajni i release gate: [kontrolni popis](docs/preview-release-checklist.md).
Nakon builda `npm run test:http` provjerava pravi lokalni Next HTTP runtime s
izričito lažnim provider/Redis servisima, uključujući stvarni SDK timeout. Bez zajedničkog limitera ili kad je konfigurirani Redis
nedostupan, chat vraća 503 i ne poziva OpenAI. Preview bez Redisa koristi samo
best-effort ograničenje po instanci, ne globalno jamstvo. Ograničenja su 8/min i
80/dan po IP-u; dijeljene mreže dijele limit. Origin provjera nije autentikacija
niti potpuna zaštita od botova. Tajne se unose u Vercel, nikad u Git.
