# FiscalBox V5.9.3.7 — ručni klijent + foto fallback fiskalnog računa + PDF kupac

Osnova: V5.9.3.6.

## KNJIGOVOĐA — Dodaj novog klijenta

- Glavno dugme **Pošalji zahtev** promenjeno je u **Dodaj novog klijenta**.
- U modalu za dodavanje klijenta više nema SMS opcije.
- Dostupna su dva načina:
  - **Email** — knjigovođa bira firmu iz APR/NBS baze, email i paket; klijentu se šalje aktivacioni email poziv.
  - **Ručno** — knjigovođa bira firmu, upisuje email, bira paket i generiše korisničko ime + lozinku.
- Kod ručnog kreiranja Supabase korisnik se pravi preko admin API-ja sa `email_confirm: true`.
- Klijent zato **ne mora da potvrđuje email**.
- Nalog firme, owner membership, subscription i aktivna veza sa knjigovođom kreiraju se odmah.
- Predračun za izabrani BASIC/PREMIUM paket kreira se automatski, isto kao i kod regularnog poziva.
- Lozinka se ne skladišti u čitljivom obliku. Knjigovođa mora da je sačuva/preda klijentu nakon kreiranja.

Novi API:

`POST /api/accountant/clients/manual-create`

## USER — mobilni login

- Dugme **Prijavi se** i **Registruj se** na mobilnom login ekranu imaju identičnu širinu, visinu, padding i veličinu teksta.

## PDF fiskalnog računa — KUPAC / FIRMA NA KOJU GLASI RAČUN

Svaki FiscalBox PDF/prikaz računa sada u delu **KUPAC / FIRMA NA KOJU GLASI RAČUN** prvo koristi podatke firme kojoj pripada FiscalBox nalog:

- naziv firme,
- pravna forma,
- PIB,
- matični broj,
- adresa,
- mesto/opština,
- šifra delatnosti,
- delatnost,
- kontakt email,
- kontakt telefon.

Ovo važi i kada QR zapis nema PIB kupca. QR kupac i dalje ostaje tehnički podatak za validaciju/knjigovodstvenu podobnost; ako se PIB iz QR-a razlikuje od PIB-a naloga, print prikaz upozorava na ručnu proveru.

Knjigovođin ZIP arhivski PDF koristi isti skup podataka firme.

## QR fallback → fotografija celog fiskalnog računa

Ako QR skener oko 12 sekundi ne uspe da pročita fiskalni QR:

1. kamera/skener prelazi u foto fallback,
2. prikazuje poruku: **QR je oštećen ili nije čitljiv — uslikajte ceo račun**,
3. dugme **Uslikaj ceo račun** otvara mobilnu kameru (`capture=environment`),
4. fotografija se šalje u novi privatni Supabase Storage bucket `receipt-images`,
5. zapis se kreira u tabeli `receipts`, NE u tabeli `documents`,
6. račun dobija `receipt_source='photo'` i status `fotografija_za_proveru`,
7. prikazuje se u istoj bazi fiskalnih računa kao QR računi,
8. knjigovođi se može poslati standardnim FiscalBox tokom,
9. print prikaz pokazuje originalnu fotografiju i označava zapis za ručnu proveru.

Ako korisnik ručno učita fotografiju QR-a i ni tada QR ne može da se dekodira, FiscalBox automatski prelazi u isti foto fallback režim.

## NOVA SQL MIGRACIJA — OBAVEZNA

Pre korišćenja foto fallback funkcije izvršiti:

`SQL_031_FOTO_FISKALNI_FALLBACK.sql`

ili odgovarajuću migraciju:

`supabase/migrations/031_v5_9_3_7_photo_receipt_fallback.sql`

Migracija dodaje:

- `receipts.receipt_source`
- `receipts.source_image_path`
- `receipts.source_image_name`
- `receipts.source_image_mime`
- private Storage bucket `receipt-images`

Pokrenuti je POSLE `SQL_030_KNJIGOVODJA_FREE_AUTO_PREDRACUN.sql`.

## Provera

- `node scripts/check-syntax.cjs` — 181 TS/TSX fajl, 0 sintaksnih grešaka.
- `npm test` nije mogao kompletno da se izvrši u radnom kontejneru jer source paket nema `node_modules` i nedostaje runtime modul `web-push`.
- Na razvojnom/produkcijskom računaru obavezno: `npm install`, `npm test`, `npm run build`.
