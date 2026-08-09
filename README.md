# Relax Bridge

A [relaxbridge.nl](https://www.relaxbridge.nl/) weboldala. Astro-alapú hibrid
oldal három nyelven: a tartalmi oldalak statikusak, a saját foglalórendszer
Vercel-függvényeken és PostgreSQL-adatbázison fut.

A régi, Strikingly-alapú oldal mentése a `snapshot/` és `content/` mappában
maradt meg — abból készült ez az átépítés.

## Indítás

```bash
npm install
npm run dev
```

A fejlesztői szerver a <http://localhost:4321> címen fut.

| Parancs | Mit csinál |
| --- | --- |
| `npm run dev` | fejlesztői szerver, mentésre azonnal frissül |
| `npm run build` | legyártja a kész oldalt a `dist/` mappába |
| `npm run preview` | a legyártott oldalt szolgálja ki, telepítés előtti ellenőrzésre |
| `npm run test:booking` | a foglalási időpontmotor automatikus tesztjei |
| `npm run db:migrate` | létrehozza vagy frissíti a foglalási adatbázist |
| `npm run admin:hash` | biztonságos admin-jelszóhash készítése |

## Felépítés

```
src/
├── data/site.ts          MINDEN elérhetőség egy helyen — telefon, e-mail, közösségi média
├── data/routes.ts        az URL-ek nyelvenkénti szegmensei
├── i18n/{nl,en,hu}.ts    a felület szövegei nyelvenként
├── content/services/     a kezelések: 6 kezelés × 3 nyelv, markdown fájlban
├── components/           a megjelenítés
├── layouts/Base.astro    a közös oldalváz (fejléc, lábléc, meta adatok)
└── pages/                az útvonalak
```

**Ha szöveget kell módosítani**, két hely van:

- egy kezelés leírása vagy ára → `src/content/services/<nyelv>/<fájl>.md`
- bármi más felirat → `src/i18n/<nyelv>.ts`

**Ha elérhetőség változik**, csak a `src/data/site.ts` fájlt kell átírni. Ez
szándékos: a régi oldalon a telefonszám szét volt szórva, és két hibás változat
is bent maradt belőle.

## Saját foglalórendszer

A publikus foglalóoldal a `/booking`, `/en/booking` és `/hu/booking` útvonalon,
az adminfelület a `/admin` útvonalon érhető el. Egy masszőr egyetlen közös
naptárát kezeli. A még szabad időpont elküldéskor azonnal véglegessé válik; az
adatbázis akkor is megakadályozza a dupla foglalást, ha két látogató egyszerre
küldi el ugyanazt az időpontot.

Első beállítás:

1. Hozz létre egy menedzselt PostgreSQL-adatbázist.
2. Másold le a `.env.example` fájlt `.env` néven, és töltsd ki a változókat.
3. Készíts legalább 12 karakteres adminjelszóhoz hash-t:

   ```powershell
   $env:ADMIN_PASSWORD='egy-hosszú-egyedi-jelszó'
   npm.cmd run admin:hash
   ```

4. A kapott értéket add meg `ADMIN_PASSWORD_HASH` néven, majd futtasd:

   ```powershell
   npm.cmd run db:migrate
   ```

5. Ugyanezeket a környezeti változókat állítsd be a Vercel projektben is.
6. Az `/admin` oldalon add meg a heti nyitvatartási sávokat. Egyedi napot vagy
   idősávot lezárhatsz, illetve extra nyitvatartást is felvehetsz.

### Foglalási e-mailek

Minden végleges foglalás két e-mailt hoz létre: az ügyfél a foglalás nyelvén
kap visszaigazolást, az `info@relaxbridge.nl` pedig magyar nyelvű értesítést.
A kézbesítési feladatok ugyanabban az adatbázis-tranzakcióban készülnek el,
mint a foglalás, ezért átmeneti e-mail-hiba esetén is megmaradnak és
újrapróbálhatók.

A küldéshez a `relaxbridge.nl` domaint hitelesíteni kell a Resendben, majd a
Resend által megadott SPF-, DKIM- és MX-rekordokat fel kell venni a TransIP DNS
beállításaiban. Ezután a következő változókat kell megadni a Vercel projektben:

```text
RESEND_API_KEY
BOOKING_EMAIL_FROM="Relax Bridge <info@relaxbridge.nl>"
BOOKING_OWNER_EMAIL=info@relaxbridge.nl
BOOKING_STUDIO_ADDRESS="A stúdió teljes címe"
CRON_SECRET
```

Az azonnali küldés mellett egy naponta futó, titkosított Vercel Cron végzi az
esetlegesen elakadt levelek újrapróbálását. Az adatbázis frissítését a kód
telepítése előtt kell futtatni:

```powershell
npm.cmd run db:migrate
```

Az alapbeállítás 15 perces időrács, 12 órás minimum előfoglalás és 60 napos
foglalási horizont. A stúdióidőpont után 15 perc, az otthoni kezelés előtt és
után 30–30 perc automatikus puffer foglalódik a közös naptárban.

## A logó

A forrás a `src/assets/logo-source.png` — fehér hátterű, átlátszóság nélkül.
Ebből készül minden származtatott kép:

```bash
node scripts/prepare-logo.mjs
```

Ez kikulcsolja a fehéret (sötét témában különben fehér téglalapként látszana),
és legyártja a `logo.png`, `logo-mark.png`, favikon- és megosztásképeket.
Csak akkor kell újra futtatni, ha a forráslogó változik.

## Színek

A „Csendes híd” rendszer meleg papírhátteret, mély fenyőzöldet és visszafogott
terrakottát használ. A zöld adja a nyugalmat és a szakmai keretet, a terrakotta
csak a fontos cselekvéseket és a hídszerű összekötő motívumokat emeli ki.

| Szerep | Szín | Kontraszt a háttéren |
| --- | --- | --- |
| háttér | `#f6f1e8` meleg papír | — |
| emelt felület | `#fffdfa` törtfehér | — |
| szöveg | `#1f2d28` zöldes grafit | 12,75:1 |
| halvány szöveg | `#625f56` meleg szürke | 5,67:1 |
| fő márkaszín | `#285247` fenyőzöld | 7,82:1 |
| linkek, CTA | `#a85030` terrakotta | 4,84:1 |
| dekoráció | `#cdbb9d` homok | csak díszítés |

**Az oldal mindig világos, nincs sötét téma.** A `:root` `color-scheme: light`
beállítása arról is gondoskodik, hogy a böngésző saját elemei (görgetősáv,
űrlapmezők) se váltsanak sötétre, ha a látogató gépe sötét témára van állítva.

A logó saját, világos színei továbbra is márkajelként maradnak meg. A felület
sötétebb fenyőzöldje és terrakottája ezek karakteresebb, akadálymentes
környezete; a hídívek végig összekötő vizuális elemként jelennek meg.

Minden szöveg- és gombszín legalább 4,5:1 kontrasztú (WCAG AA). Ellenőrzés:

```bash
node scripts/check-contrast.mjs
```

## URL-ek

A holland az alapértelmezett nyelv, előtag nélkül. 21 oldal készül.

| | holland | angol | magyar |
| --- | --- | --- | --- |
| főoldal | `/` | `/en` | `/hu` |
| stúdió | `/massage/…` | `/en/massage/…` | `/hu/masszazs/…` |
| házhoz | `/home-service/…` | `/en/home-service/…` | `/hu/hazhoz/…` |

A régi oldal aloldalai (`/relaxmassage`, `/voetmassage`, …) a `vercel.json`
fájlban 301-es átirányítást kaptak az új helyükre, hogy a meglévő linkek és a
Google-találatok ne törjenek el.

## SEO

Ami a régi oldalról hiányzott, és most benne van:

- oldalanként saját cím és leírás, bennük a `massage` és a `Tilburg` szóval
- `hreflang` a három nyelvi változat között, `x-default`-tal
- `LocalBusiness` strukturált adat (`HealthAndBeautyBusiness` + `MassageTherapy`)
  és `FAQPage` a „Jó tudni" blokkból, kezelésenként `Service` az árakkal
- oldalanként pontosan egy `<h1>`
- `alt` szöveg minden képen
- `sitemap-index.xml` és `robots.txt`

## Telepítés Vercelre

1. Vercelen „New Project", a `relax-bridge` GitHub-repo importálása.
2. A keretrendszert magától felismeri (Astro). Külön beállítás nem kell.
3. Domain: a `www.relaxbridge.nl` és a `relaxbridge.nl` rákötése.
4. **A régi nyelvi aldomainek** (`en.relaxbridge.nl`, `hu.relaxbridge.nl`) is
   vegyük fel domainként, átirányítással a `www.relaxbridge.nl/en`, illetve
   `/hu` címre. Enélkül a régi linkek és a Google-találatok eltörnek.

Minden `main`-re push automatikusan új verziót telepít.

## Ami még hiányzik

A `src/data/site.ts` fájlban `TODO` jelöléssel:

- **a stúdió pontos címe** és a **nyitvatartás** — ezek nélkül a strukturált
  adat hiányos, és a Google Cégprofil sem tud rendesen bekötni.

Ezen felül: **„rólam" rész és vélemények.** Masszázsnál ez dönt a bizalomról, és
a régi oldalon egyik sem volt. A fotók megvannak hozzá, a szöveg hiányzik.

A régi oldal további hibái az [AUDIT.md](AUDIT.md) fájlban.
