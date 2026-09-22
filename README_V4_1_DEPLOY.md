# FiscalBox V4.1 — dodatak na V4

## Šta dodaje
- QR račun se odmah pojavi na listi nakon uspešnog očitavanja.
- Logo/profilna slika firme na Home ekranu.
- Automatska inteligentna kategorizacija iz dobavljača i artikala sa računa.
- Filter i pregled troškova po kategoriji.
- Instant dugme „Pošalji knjigovođi“.
- Knjigovođa vidi samo račune koji su mu poslati.
- Automatsko slanje: nedeljno petkom ili mesečno poslednjeg dana.
- Uključena prethodna V4 MASTER TypeScript ispravka.

## 1. Supabase SQL — obavezno prvo
U Supabase SQL Editor-u pokrenite:

`supabase/migrations/003_v4_1_user_receipts.sql`

Očekivani rezultat: `Success. No rows returned`.

## 2. Vercel CRON_SECRET
U Vercel projektu otvorite Environment Variables i dodajte:

`CRON_SECRET`

Vrednost treba da bude duga nasumična lozinka, npr. 40+ znakova. Ne stavljati je u GitHub.

Ova promenljiva štiti dnevni cron endpoint. Vercel cron se pokreće svakog dana u 05:30 UTC i šalje račune samo kada je raspored za firmu dospeo:
- weekly: petak
- monthly: poslednji dan u mesecu

Bez `CRON_SECRET` ručno/instant slanje radi, ali automatski cron neće izvršiti slanje.

## 3. Kopiranje patch-a
Kopirajte SADRŽAJ foldera `FiskalniInboxV4_1_Patch` u lokalni `fiskalni-inbox-v2` repo i potvrdite Replace.
Nemojte kopirati spoljašnji patch folder kao novi podfolder.

## 4. GitHub Desktop
Summary:

`Add V4.1 user automation and categories`

Zatim:
- Commit to main
- Push origin

Vercel će automatski napraviti deployment.

## 5. Provera
Testirati:
- `user / user` demo: logo, QR immediate add, kategorije, instant send i Više > automatsko slanje.
- pravi USER: logo upload, skeniranje pravog QR-a, automatska kategorija, slanje knjigovođi.
- pravi KNJIGOVOĐA: vidi samo poslate fiskalne račune.

## Kategorizacija
V4.1 koristi lokalni „smart classifier“ bez dodatnog API ključa, na osnovu merchant/item tekstova iz fiskalnog odgovora. Ako nema pouzdanog podudaranja, kategorija je `Ostalo`.
Kasnije se može zameniti/spojiti sa eksternim AI modelom bez promene UI-a.
