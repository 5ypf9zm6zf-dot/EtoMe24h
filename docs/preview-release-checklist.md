# EtoMe24h: siguran završetak Preview provjere

Ne spajati PR i ne objavljivati Production dok svi release uvjeti nisu potvrđeni.
Ne mijenjati originalne plakate. Nikada ne slati tajne u chat, Git ili logove.

## 1. OpenAI — korak vlasnika tajne

U postojećem projektu otvoriti **Environment Variables** u sidebaru.
Za postojeći Preview `OPENAI_API_KEY`: izbornik s tri točke → **Edit**,
unijeti valjan ključ, tip **Secret**, odabrati **Preview**, zatim **Save**.
Odabrati zapis koji cilja samo Preview i nema Git branch ograničenje.
Ne mijenjati zasebni zapis za `fix/preview-gpt5-env-key`: to nije grana ovog PR-a.
Za ovu PR granu (`fix/consolidated-ai-route-security`) provjeriti da nema
neželjenog branch overridea. Ne označavati Production ili Development i ne
mijenjati druge zapise. Production je izvan opsega ovog postupka.
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
Povezati isključivo Preview; ne odabrati Production niti Development.

CLI nema opciju za spremanje nepotvrđene instalacije bez popratnih promjena.
`integration accept-terms` instalira integraciju i traži ljudsku potvrdu uvjeta;
`integration add` stvara novi resurs, pa nije način spajanja postojeće baze.
Ne prihvaćati uvjete ili pokretati novi resurs bez odobrenja vlasnika.

Kad vlasnik autentificira račun i postojeći resurs postane vidljiv u timu,
preostala CLI radnja može biti samo sljedeća veza (zamijeniti oznaku ID-em
resursa iz stvarnog inventara; naredba još NIJE izvršena):

```sh
vercel integration resource connect <resource-id> etome24h --environment preview --scope etome24 --yes
```

Takva radnja traži zasebno odobrenje za povezivanje resursa i Preview varijable.
Ne izostaviti `--environment preview`: zadani opseg uključuje i Production.
Ako baze nema, vlasnik prvo bira resurs/plan; nije moguće unaprijed obećati
samo jednu završnu potvrdu. Prije nove baze provjeriti automatsku nadogradnju
plana i eviction; CLI metapodaci navode `autoUpgrade=true` kao zadanu vrijednost.
Za limiter ne uključivati eviction koji može ukloniti aktivne brojače.

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
npm ci
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

## 5. Operaterska provjera nakon autorizacije resursa

Dodani su `npm run verify:models` i `npm run verify:redis`. To su alati za
operatera/agenta, ne dodatni tehnički zadaci vlasnika. Nisu build/deploy hookovi,
ne otvaraju javni dijagnostički endpoint i ne izvršavaju se automatski.
Oba odbijaju rad ako `VERCEL_ENV` nije točno `preview`. Koristiti samo ovlaštene
Preview tajne u okruženju procesa; ne slati ih u chat, argumente naredbe ili Git.
Spremljeni Vercel Secret nije moguće dohvatiti preko env pulla; `[SENSITIVE]`
nije ključ. Ne mijenjati ili zamjenjivati postojeći ključ samo radi ovog alata.
Ako operater nema pristup tajni i mreži providera, provjera ostaje blokirana.

- `verify:models`: čita stvarni OpenAI katalog računa koristeći instalirani SDK,
  bez generiranja teksta, automatske promjene modela ili fallbacka. Ispisuje samo
  poznate cjenovne kandidate i vidljivost konfiguriranog modela, ne puni katalog
  ili detalje računa. Vidljivost nije dokaz raspoloživog kredita ni uspješne
  inferencije. Nakon vidljivosti slijedi odvojeni stvarni hrvatski chat test;
  tek taj prolaz dopušta izbor modela. Alat ne tvrdi da je njegov popis svih
  mogućih modela iscrpan.
- `verify:redis`: najprije traži `PING` → `PONG` te `SET`/`GET`/`DEL` round-trip
  s provjerom da obrisani probni ključ više ne postoji. Probni ključ ima TTL 60 s
  i ciljano čišćenje i kod neuspjeha. Zatim piše samo nasumične `etome:readiness:preview:<uuid>:*` ključeve
  u odobrenoj Preview bazi. Koristi točan Lua iz routea: devet paralelnih poziva,
  jedinstveni brojači 1–9, TTL 60/86400 i izolirana dnevna granica 80→81, pa DEL
  samo tih dvaju limiter ključeva. TTL ograničava ostatke pri prekidu veze. Troši Redis
  naredbe; ne pokretati bez odobrenog resursa. Ne poziva AI, ne uređuje stvarne
  IP brojače, ne koristi FLUSHDB/KEYS i ne dokazuje deployed HTTP status, dvije
  Vercel instance, protek stvarnog dana ili failover. Te release provjere iz
  odjeljka 3 ostaju odvojene. Ne koristiti produkcijsku bazu.
- Neispravni odgovori, djelomični parovi, nesigurni URL-ovi i greške čišćenja
  završavaju neuspjehom; CLI ne ispisuje sirove provider/Redis greške ili tajne.
- `npm test` uključuje fixture testove ovih alata. Prolaz fixture testova nije
  dokaz dostupnosti živog modela ili stvarne Redis baze.

### Modeli i cijene (službena provjera 2026-11-28)

`gpt-6-luna` postoji u službenom katalogu i podržava postojeći Responses API.
Standardna cijena za kratki kontekst: $0.10 ulaz / $0.50 izlaz na milijun tokena;
cache read $0.01. `reasoning.effort=none` postoji, ali nije automatski dodan
postojećim modelima. Zadani reasoning troši isti ograničeni izlazni budžet pa je
stvaran dovršen hrvatski odgovor s limitom 400 tokena obvezan prije odabira.
`gpt-5-nano` ima nižu objavljenu cijenu $0.05 / $0.40, ali je Deprecated;
niža cijena ne dokazuje prikladnost hrvatskog odgovora ili pristup računa.
`gpt-4.1-nano` je Shut down i nije kandidat.
Nijedan novi model nije aktiviran bez provjere računa. Postojeći zadani
`gpt-5-mini` u ovom nastavku nije promijenjen; i on zahtijeva odluku prije releasea.
Nema automatske migracije, kupnje kredita ili promjene Production varijabli.

Izvori:
- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://developers.openai.com/api/docs/models/gpt-5-nano
- https://developers.openai.com/api/docs/models/gpt-4.1-nano
- https://developers.openai.com/api/docs/pricing

### Besplatna Redis priprema, bez prihvaćanja uvjeta

CLI katalog nudi plan `free`; to nije dokaz da je besplatni resurs već stvoren
ili da je račun podoban. Planirati `autoUpgrade=false`, `eviction=false`,
`prodPack=false`; nema automatskog prelaska na `paid` ako Free nije dostupan.
Prije bilo kakvog stvaranja potreban je prihvat uvjeta vlasnika, a prije veze
odobrenje ciljane Preview promjene. Instalacija i baza nisu isto. Agent zatim
može izvršiti povezivanje i provjere; vlasnik ne treba ručno kopirati Redis tajne
kad ovlaštena Marketplace integracija može postaviti cijeli par.
