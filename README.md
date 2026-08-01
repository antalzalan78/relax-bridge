# Relax Bridge

A [relaxbridge.nl](https://www.relaxbridge.nl/) weboldala. Astro alapú statikus
oldal, három nyelven, Vercelre telepítve.

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

## A logó

A forrás a `src/assets/logo-source.png` — fehér hátterű, átlátszóság nélkül.
Ebből készül minden származtatott kép:

```bash
node scripts/prepare-logo.mjs
```

Ez kikulcsolja a fehéret (sötét témában különben fehér téglalapként látszana),
és legyártja a `logo.png`, `logo-mark.png`, favikon- és megosztásképeket.
Csak akkor kell újra futtatni, ha a forráslogó változik.

A színpaletta a logóból jön: zöld `#56b44a`, lila `#8755b6`, narancs `#fdaa38`.
A logó saját zöldje világos háttéren csak 2,47:1 kontrasztú, ezért szöveghez és
gombhoz egy sötétebb változat megy (`#35782c`, 5,11:1), a logó zöldje pedig
dekoráció marad. Az arányokat ellenőrizni:

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

- **e-mail cím** — a régi oldalon üresen állt, a sablonban pedig egy nem létező
  `info@relaxbridge.com` maradt. Amíg nincs valódi cím, sehol nem jelenik meg.
- **a stúdió pontos címe** és a **nyitvatartás** — ezek nélkül a strukturált
  adat hiányos, és a Google Cégprofil sem tud rendesen bekötni.
- **foglalórendszer** — jelenleg a WhatsApp az egyetlen út. A `bookingUrl`
  kitöltésével köthető be.

Ezen felül: **„rólam" rész és vélemények.** Masszázsnál ez dönt a bizalomról, és
a régi oldalon egyik sem volt. A fotók megvannak hozzá, a szöveg hiányzik.

A régi oldal további hibái az [AUDIT.md](AUDIT.md) fájlban.
