# Zsófi Masszázs – weboldal időpontfoglalással

Elegáns, mobilra optimalizált weboldal **Kosztolányi Zsófia** természetgyógyász, reflexológus számára
(2534 Tát, Fő út 126.), beépített online időpontfoglalással.

## Mit tud az oldal?

- **Bemutatkozás, kezelések, első alkalom menete, elérhetőség, térkép, rendelési idő** (a mai nap kiemelve)
- **Időpontfoglalás 4 lépésben:** kezelés → nap → időpont → adatok
  - a naptárban színnel jelölve: van szabad hely / kevés hely / betelt vagy zárva
  - a **foglalt időpontok szürkén, áthúzva, „foglalt” felirattal** jelennek meg
  - a szerver ellenőrzi az ütközést, így két ember nem foglalhatja le ugyanazt az időpontot
  - az oldal percenként frissíti a szabad helyeket
  - sikeres foglalás után „Hozzáadás a naptárhoz” (.ics)
  - a hero-ban a „Következő szabad időpont” automatikusan frissül
- **Admin felület** (`/admin.html`): foglalások listája, lemondás, napok / idősávok letiltása (pl. szabadság)
- **Mobilon:** alsó gyorssáv (Hívás · Messenger · Foglalás), teljes képernyős menü, érintésbarát gombok
- SEO: meta leírás, Open Graph, schema.org `HealthAndBeautyBusiness` adatok
- Adatkezelési tájékoztató (GDPR) a foglalási űrlapnál

## Futtatás

Node.js 18+ szükséges, más függőség nincs.

```bash
ADMIN_PASSWORD="erős-jelszó" npm start
# → http://localhost:3000   (admin: http://localhost:3000/admin.html)
```

| Változó | Jelentés |
|---|---|
| `PORT` | port (alapértelmezés: 3000) |
| `ADMIN_PASSWORD` | az admin felület jelszava – enélkül az admin ki van kapcsolva |
| `DATA_DIR` | a foglalások mappája (alapértelmezés: `./data`, gitignore-olva) |

Tesztek: `npm test`

### Tárhely

- **Teljes funkcionalitás** (valódi, közös foglalási naptár): bármilyen Node-ot futtató tárhely
  (pl. Render, Railway, Fly.io, saját VPS). Fontos, hogy a `DATA_DIR` tartós tárolón legyen.
- **Csak statikus tárhely** (pl. GitHub Pages, Netlify szerver nélkül): az oldal ekkor is működik,
  a foglalás pedig **foglalási kéréssé** alakul, amelyet a vendég SMS-ben vagy e-mailben küld el
  (előre kitöltve), Zsófi pedig visszaigazolja. Ilyenkor a foglalt időpontok nem látszanak.

## Adatok módosítása

Minden üzleti adat egy helyen van: **`assets/js/config.js`** – név, telefonszám, e-mail, cím,
Facebook, **nyitvatartás**, **kezelések (név, leírás, időtartam, ár)**, foglalási szabályok
(30 perces rács, 60 nap előre, legalább 2 órával előre). A szerver is ezt a fájlt használja.

Fotó hozzáadása: tegye a képet ide: `assets/img/zsofi.jpg`, és az `index.html`-ben a
„Rólam” szekcióban cserélje a helyőrzőt a megjegyzésben lévő `<img>` sorra.

## Adatforrások és amit érdemes ellenőrizni

Az adatok a nyilvános Facebook-oldalról ([facebook.com/zsofimasszazstat](https://www.facebook.com/zsofimasszazstat/))
és a [zsofimasszazs.hu](https://zsofimasszazs.hu/) oldalról származnak:
név, telefonszám, e-mail, cím, rendelési idő (H 14–19, K–Sze 9–14, Cs 8–13, P 9–14),
kezelések és azok leírása, bemutatkozás.

**Nem találtam nyilvános adatot, ezért ellenőrizendő / kitöltendő:**

- **Árak** – jelenleg „Ár egyeztetés szerint” jelenik meg (`price: null`). Pl. `price: 12000` → „12 000 Ft”.
- **Kezelések időtartama** – becsült értékek (masszázs, talpreflexológia, Bach: 60 perc; fülakupunktúra, EWS: 30 perc).
- **Irányítószám** (2534) és a Messenger link (`m.me/zsofimasszazstat`).
- **Fotók** – a Facebook-képek nem voltak elérhetők, ezért az oldal jelenleg illusztrációkat használ.
