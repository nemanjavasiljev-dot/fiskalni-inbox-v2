# FiscalBox V5.9.3.2 — QR fullscreen, duplikati i PIB kontrola

## Šta je promenjeno

### 1. Auto-zoom može da se zaključa dodirom
- Oznaka `Auto-zoom X×` je sada dugme.
- Jedan dodir zaustavlja automatsko menjanje zoom-a i zaključava trenutni kadar.
- Ponovni dodir ponovo uključuje auto-zoom.
- Ručno pomeranje zoom slidera takođe automatski zaključava auto-zoom.

### 2. QR skener je fullscreen
- QR skener se otvara preko cele aplikacije, uključujući header.
- Ima sopstveni fullscreen header i jasno dugme `Zatvori`.
- Kamera zauzima glavni deo ekrana, a funkcije skenera su odmah ispod i dostupne skrolom.
- Implementacija koristi React portal da scanner ne zavisi od layout-a stranice.

### 3. Isti fiskalni račun više ne može ponovo da se upiše
- I dalje postoji stara zaštita po `organization_id + qr_url`.
- Dodata je druga zaštita po stabilnom `receipt_fingerprint` identitetu računa.
- Fingerprint koristi PIB prodavca, broj računa i SDC vreme; ako podaci nisu dostupni koristi kanonizovani QR URL.
- Baza ima unique indeks po `organization_id + receipt_fingerprint`.
- Ako korisnik ponovo skenira isti račun dobija poruku: **„Ovaj račun je već skeniran.“**
- Duplikat se ne upisuje ponovo.

### 4. Provera ID/PIB kupca pre čuvanja
- Nakon čitanja QR-a FiscalBox proverava fiskalni zapis i traži `ID kupca` / `BuyerId` / PIB.
- Ako PIB postoji, nastavlja normalno.
- Ako PIB ne postoji, račun se NE čuva automatski.
- Korisnik dobija upozorenje i bira:
  - `Ne, skeniraj ponovo`
  - `Da, sačuvaj ipak`
- Ako se ipak sačuva, račun dobija:
  - `buyer_pib_status = missing`
  - `saved_without_buyer_pib = true`
  - `bookkeeping_eligible = false`
- Takav račun u UI ima oznaku **BEZ PIB KUPCA · ARHIVA**.
- AI PDV analiza za takav račun daje preporuku `NE` sa 100% sigurnošću, uz napomenu da je potrebna ručna provera.

## SQL
Pre deploy-a pokrenuti:

`SQL_029_QR_DUPLIKATI_PIB_GATE.sql`

SQL dodaje kolone i unique indeks za zaštitu od duplikata.

## Deploy
1. Pokrenuti SQL 029 u Supabase SQL Editor-u.
2. Upload/commit V5.9.3.2 na GitHub.
3. Vercel redeploy.
4. Testirati:
   - isti račun dva puta;
   - račun sa `ID kupca: 10:PIB`;
   - račun bez ID/PIB kupca;
   - zaključavanje auto-zoom-a dodirom;
   - fullscreen QR na mobilnom.

## Provera paketa
- Syntax check: 174 TS/TSX, 0 sintaksnih grešaka.
- Puni regression test nije pokrenut jer u lokalnom radnom okruženju nije instaliran `web-push` modul iz node_modules.
