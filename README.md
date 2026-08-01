# Relax Bridge

A [relaxbridge.nl](https://www.relaxbridge.nl/) weboldal forrása.

Jelenlegi állapot: **archívum + előkészítés**. Az élő oldal még a Strikingly nevű
szerkesztőn fut; ez a repo egyelőre a régi oldal mentését és a tartalmat tárolja,
hogy a teljes átépítés ne nulláról induljon.

## Mi van a repóban

| Mappa | Tartalom |
| --- | --- |
| `snapshot/nl`, `snapshot/en`, `snapshot/hu` | A régi oldal összes aloldalának nyers HTML mentése, mindhárom nyelven (2026-08-01) |
| `snapshot/assets/` | A CDN-ről visszaszedett eredeti, teljes felbontású képek |
| `content/nl`, `content/en`, `content/hu` | Az oldalanként kinyert **tiszta szöveg** — ez megy majd át az új oldalra |
| `AUDIT.md` | A régi oldal átvizsgálása: mi hiányzik, mi hibás, mit kell javítani |

A `snapshot/` fájlok gépi mentések, nem szerkesztendők. A tartalmi munkát a
`content/` alatt érdemes végezni.

## Az oldal jelenlegi felépítése

Három nyelvi verzió külön aldomainen:

- `www.relaxbridge.nl` — holland
- `en.relaxbridge.nl` — angol
- `hu.relaxbridge.nl` — magyar

Szolgáltatások (mindhárom nyelven élő):

- **Studio visit** — Relaxmassage, Nek-Schouder-Rugmassage, Gezichtsmassage, Voetmassage
- **Home service** — Relaxmassage, Nek-Schouder-Rugmassage

Külső szolgáltatások, amiket az oldal használ:

- Ajándékutalvány: SumUp
- Kapcsolat: WhatsApp (+31 6 53964923) és beépített űrlap
- Zenei lejátszási listák: Spotify, YouTube Music

## Következő lépés

Teljes átépítés saját kódbázisra. A technológiai döntés még nyitott.

## A mentés újrafuttatása

A `snapshot/` és a `content/` a régi oldal automatikus mentése. Amíg az élő oldal
a Strikinglyn fut, frissíthető — a lépések az `AUDIT.md` végén vannak.
