# EtoMe24h: siguran završetak Preview provjere

Ne spajati PR i ne objavljivati Production dok svi release uvjeti nisu potvrđeni.
Ne mijenjati originalne plakate. Nikada ne slati tajne u chat, Git ili logove.

## 1. OpenAI — korak vlasnika tajne

U postojećem projektu otvoriti **Environment Variables** u sidebaru.
Za postojeći Preview `OPENAI_API_KEY`: izbornik s tri točke → **Edit**,
unijeti valjan ključ, tip **Secret**, odabrati **Preview**, zatim **Save**.
Za ovu PR granu provjeriti da nema neželjenog branch overridea.
Za **Production** dodati zaseban valjan ključ s točno istim nazivom.
Varijable drukčijeg naziva, primjerice `open_api_kay`, kod ne čita.
Ne preimenovati i ne brisati druge tajne bez provjere njihove namjene.
Ključ se čita samo na poslužitelju preko `process.env.OPENAI_API_KEY`.

HTTP 401 od OpenAI-ja znači da provider nije prihvatio autentikaciju; nije dokaz
uspješnog AI odgovora. Skriveni spremljeni Secret nije moguće pregledati radi
dijagnoze. Zamijeniti ga valjanim ključem ovlaštenog OpenAI projekta.
Ne kopirati redakciju `[SENSITIVE]` kao vrijednost i ne koristiti `NEXT_PUBLIC_`.

Promjene vrijede tek u novom deploymentu. Ponovno izgraditi isključivo Preview,
a zatim poslati stvarno kratko pitanje kroz chat. Za prolaz tražiti HTTP 200,
smislen netestni odgovor i odsutnost provider grešaka u odgovarajućem runtime logu.
Prazan ili nedovršen provider odgovor mora ostati 502, ne lažni uspjeh.

Izvor: https://vercel.com/docs/environment-variables/sensitive-environment-variables

## 2. Upstash — korak ovlaštenog vlasnika računa

Otvoriti https://vercel.com/marketplace/upstash i odabrati Redis integraciju.
Prijaviti se na ovlašteni Upstash račun, odabrati postojeću bazu i povezati je s
postojećim projektom. Ne otvarati novi Vercel projekt. Ako baze nema, vlasnik
mora odabrati odgovarajući resurs i plan; ne pretpostavljati suglasnost za trošak.
Provjeriti da veza pokriva Preview i, za kasniju objavu, Production.

Kod podržava izravni Upstash par:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN` (Secret)

Vercel Marketplace par `KV_REST_API_URL` / `KV_REST_API_TOKEN` također je
podržan, bez ručnog kopiranja tajni. Izravni `UPSTASH_*` par ima prednost;
ne miješaju se URL i token iz različitih parova. Ako integracija postavi drugi
prefix, potrebno je ciljano prilagoditi konfiguraciju. Preview i Production
imaju odvojene Redis ključeve po projektu, stabilne između deploymenta.
Koristiti REST URL/token, ne `redis://` TCP adresu ni read-only token: limiter
mora moći izvršiti atomski `EVAL` s `INCR` i `EXPIRE` za dva ključa.

Izvor: https://vercel.com/marketplace/upstash/upstash-kv

## 3. Provjera zajedničkog limitera na stvarnom Redis resursu

Nakon novog Preview deploymenta i valjanog AI ključa:

1. U izoliranom Preview okruženju, bez resetiranja postojeće baze, poslati osam
   valjanih zahtjeva s istog stvarnog IP-a unutar istog kalendarskog minutnog bucketa.
2. Deveti zahtjev mora vratiti 429 i `Retry-After: 60`, bez poziva AI provideru.
3. Raspodijeliti zahtjeve između dvije funkcijske instance ili dvaju Preview
   deploymenta istog projekta. Sama ponavljanja na jednoj instanci nisu dokaz
   globalnosti. U bazi provjeriti iste hashed-IP brojače i njihove TTL-ove.
4. Provjeriti dnevni prag 80 bez nepotrebnih plaćenih AI poziva, korištenjem
   zasebne testne baze i kontroliranog brojača. Ne uređivati produkcijske brojače.
5. Nedostupnost konfiguriranog Redisa mora zatvoriti pristup s 503, nikada
   prebaciti na lokalni limiter. Kvar simulirati samo u izoliranom Previewu.

Preview bez Redisa ima samo best-effort limiter po instanci. To nije globalni
Redis limiter. Origin provjera nije autentikacija ni potpuna zaštita od botova.
Ograničenja su fiksni vremenski bucketi (8/min, 80/dan), ne klizni prozori.

## 4. Ponovljivi lokalni testovi i release gate

```sh
npm install
npm test
npm run build
npm run test:http
```

`test:http` podiže dva stvarna Next produkcijska poslužitelja na lokalnim portovima
3211/3212 i koristi instalirani OpenAI SDK. OpenAI i Redis HTTP servisi su eksplicitno
**testne fixture usluge**, ne dokaz stvarnog AI-ja ili Upstash Redisa. Test uključuje
stvarno čekanje SDK timeouta (20 s), 400/403/413/415/429, mapiranje provider grešaka,
redakciju logova i SEO/image HTTP provjere. Unit test provjerava 408 nakon 10 s
sporog tijela zahtjeva. Ne pokretati testni server s pravim tajnama.

Za završni merge dodatno tražiti na točnom PR head Previewu: svih šest kartica i
modala na desktopu i mobilnom prikazu, originalne slike bez izmjena, WWW canonical,
sitemap i robots, stvaran uspješan AI odgovor, stvaran zajednički Redis limiter,
negativne deployed HTTP testove i čiste runtime logove. Lokalni prolaz nije dokaz
ponašanja Vercel edge/proxy sloja. Ne slabliti zaštitu radi testa.
