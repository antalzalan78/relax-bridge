# A régi oldal átvizsgálása

Készült: 2026-08-01, a `snapshot/` mentés alapján. Platform: Strikingly.

## 1. Rejtett tartalom az oldal adataiban

Az oldal beágyazott adataiban olyan szövegek is benne vannak, amik a látogatónak
sehol nem jelennek meg. Ezek részben **kész, megírt szolgáltatásleírások** —
kár lenne elveszíteni őket az átépítéskor:

- Deep Tissue massage
- Sportmassage
- Anti-Cellulite massage
- Zwangerschapsmassage (kismama-masszázs, második trimesztertől)

Szintén az adatokban maradt, de nem látszik: „Maak je een afspraak. **In Tilburg**",
„… **Reeshof**", „… **Tilburg**" — vagyis a helymegjelölés valamikor szerepelt.
Az új oldalon ennek látszania kell, a helyi keresés miatt.

**Teendő:** eldönteni, melyik szolgáltatás kerül élesbe, és melyik marad ki.

## 2. Sablonmaradványok — ezek hibák

A Strikingly alapsablon kitöltetlen szövegei bent maradtak az oldal adataiban:

- `About Us / Our Mission / We're Hiring! / Resources / Tutorials / Brand Assets`
- `Subscribe to Our Newsletter`
- **`Contact Us info@relaxbridge.com`** — ilyen e-mail cím nincs, és a domain is
  hibás (`.com`, nem `.nl`)
- **`WhatsApp +31612595922`** — ez **nem** a valódi szám. A helyes: +31 6 53964923

A két rossz elérhetőség a legsúlyosabb: ha bármelyik megjelenik, a vendég nem ér el
senkit. Az új oldalon egyetlen helyen szabad tárolni az elérhetőségeket.

## 3. SEO

- A `<meta name="description">` és az `og:description` **üres** → a Google
  találatban nincs mit kiírni.
- Az oldalcím minden oldalon csak „Relax Bridge" — nincs benne sem `massage`,
  sem `Tilburg`. Senki nem erre a szóra keres.
- **Nincs `hreflang`** a három nyelvi verzió között. A Google így duplikációnak
  látja őket, és nem tudja, kinek melyiket adja.
- A strukturált adat egy üres `WebSite` séma. Helyette **`LocalBusiness`** /
  `MassageTherapy` kellene: cím, nyitvatartás, szolgáltatási terület, árak.
  Ez viszi a helyi találatokat és a Térkép-megjelenést.
- A főoldalon **7 darab `<h1>`** van, mind tartalmatlan („Home service",
  „Studio visit", háromszor ismételve a képváltó miatt).
- A képeken **nincs `alt` szöveg**.

## 4. Foglalás

Nincs valódi online időpontfoglalás. A szöveg azt ígéri, hogy „a weboldalon
keresztül egyszerűen foglalhatsz" és „az árakat foglalás közben látod", a
gyakorlatban viszont csak WhatsApp és egy kapcsolatfelvételi űrlap van.
Ez a legnagyobb konverzióvesztés — és a szöveg jelenleg félrevezető.

## 5. Bizalmi elemek

Masszázsnál ez dönt, és mind hiányzik:

- nincs „rólam" rész arccal és képzettséggel
- nincs egyetlen vélemény vagy értékelés sem
- nincs kiírva a professzionális (nem erotikus) jelleg — ez ennél a
  szolgáltatásnál fontos előszűrő, és a Home service-nél a vendég és a masszőr
  biztonsága szempontjából is számít

## 6. Árak

A 60 perc / 90 perc – €65 / €95 árak csak az egyes aloldalak alján szerepelnek.
Nincs áttekintő ártáblázat, így a látogatónak végig kell kattintania a menüt.

## 7. Elírások az élő oldalon

- „Volg me op **Istagram**" → Instagram
- Cookie-szöveg: „Door verder te gaan **gaan gaan** we ervan uit…"
- A Contact blokkban az „E-mail :" felirat után **nincs cím**
- A leírásokban: „langzamere**.** stevigere" (pont vessző helyett),
  „**streess**volle", „**mental** ontspanning" (`mentale`), „zwaar belast**e** voeten"

## 8. Google Cégprofil

Nem találtam rá hivatkozást, sem térképet az oldalon. Egy tilburgi masszázsnál a
Google Cégprofil hozza a forgalom nagy részét, és ingyenes.

---

## A mentés újrafuttatása

Amíg az élő oldal a Strikinglyn fut, a `snapshot/` és `content/` frissíthető.
A folyamat: az aloldalak listáját a főoldal HTML-jéből kell kiszedni (a három
nyelven **eltérnek** a linkek), majd oldalanként letölteni. A tiszta szöveg nem a
HTML-ből jön, hanem a beágyazott JSON `"value"` mezőiből — a látható HTML-ben a
lenyíló blokkok tartalma nem szerepel.

A képek a `custom-images.strikinglycdn.com` CDN-en vannak. Az átalakítási
paraméterek elhagyásával (`c_limit,fl_lossy,...`) az **eredeti felbontás** jön le —
a `snapshot/assets/` már ezeket tartalmazza.
