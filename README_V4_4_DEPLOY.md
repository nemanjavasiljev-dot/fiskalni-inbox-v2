# Fiskalni Inbox V4.4 — KNJIGO CRM, tim i desktop app

## Šta je dodato

- Pretraga klijenata po nazivu ili PIB-u.
- Logo klijenta kao prvi element na kartici klijenta.
- Jasna mesečna arhiva unutar klijenta (postojeći obračunski meseci + PDV arhiva).
- Dugme **Dodaj klijenta**:
  - PIB lookup preko postojećeg APR adaptera,
  - email + telefon klijenta,
  - kanal poziva: Email / SMS / oba,
  - ako je firma već registrovana, povezuje se odmah,
  - ako nije, generiše bezbedan pozivni link koji važi 30 dana.
- Klijent preko poziva samo postavlja lozinku; sistem kreira username, firmu, 10-dnevni trial i vezu sa knjigovođom.
- Logo knjigovodstvene agencije sa automatskim kvadratnim crop/fit formatom.
- Podešavanja KNJIGO naloga i notifikacija.
- Admin knjigovođa može da kreira naloge zaposlenih i dodeljuje im klijente.
- Zaposleni vidi samo klijente koji su mu dodeljeni. Admin vidi sve.
- PWA/Desktop instalacija:
  - Chrome / Edge install prompt,
  - Firefox Web Apps u podržanom Firefox-u za Windows.

## 1. Supabase migracija — OBAVEZNO PRVO

Supabase > SQL Editor > New query.

Pokrenite ceo sadržaj:

`supabase/migrations/006_v4_4_accounting_agency.sql`

Očekivani rezultat: `Success. No rows returned`.

## 2. Email pozivi — opciono

Ako već imate Resend iz V4.3, ništa dodatno nije potrebno:

- `RESEND_API_KEY`
- `APP_EMAIL_FROM`

Ako nisu podešeni, poziv se i dalje kreira i aplikacija daje link koji se može ručno kopirati.

## 3. SMS pozivi — opciono

Za automatski SMS preko Twilio dodajte u Vercel Environment Variables:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

Telefon klijenta unosite u međunarodnom formatu, npr. `+381...`.

Bez SMS ključeva poziv ostaje sačuvan i link može ručno da se pošalje.

## 4. APR

V4.4 koristi isti APR adapter kao V4/V4.3:

- `APR_API_URL`
- `APR_API_TOKEN`
- `APR_API_TOKEN_HEADER`
- `APR_API_TOKEN_PREFIX`

Ako APR nije konfigurisan, knjigovođa može ručno uneti naziv firme nakon PIB-a.

## 5. Kopiranje patch-a

1. Raspakujte `FiskalniInboxV4_4_Patch.zip`.
2. GitHub Desktop > Repository > Show in Explorer.
3. Kopirajte **sadržaj** patch foldera direktno u lokalni `fiskalni-inbox-v2`.
4. Potvrdite Replace za postojeće fajlove.
5. Ne kopirajte ceo patch folder kao podfolder.

## 6. GitHub

Summary:

`Add V4.4 accounting CRM staff and desktop app`

Zatim:

- Commit to main
- Push origin

Vercel automatski pokreće build.

## 7. Test posle deploy-a

Kao admin knjigovođa:

1. Dashboard — pretraga klijenta po nazivu i PIB-u.
2. Dodaj klijenta — PIB, naziv, email, telefon, kanal poziva.
3. Otvori klijenta — promeni obračunski mesec i proveri arhivu.
4. Podešavanja — ubaci logo.
5. Podešavanja > Zaposleni — kreiraj test zaposlenog i dodeli mu samo jednog klijenta.
6. Prijavi se kao taj zaposleni — treba da vidi samo dodeljenog klijenta.
7. Podešavanja > Desktop app — test instalacije.

## Napomena o providerima

Email/SMS slanje zahteva spoljne provider ključeve. Funkcija poziva i sigurni link rade i bez njih.
