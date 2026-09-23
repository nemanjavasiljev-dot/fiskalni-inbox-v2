# FiscalBox V4.3 — Registracija i povezivanje knjigovođe

## Šta je novo

- Dugme **Registruj se** na landing i login stranici.
- Registracija bira: **Firma** ili **Knjigovođa**.
- Username + email + lozinka.
- PIB ili matični broj; APR lookup koristi postojeći APR adapter.
- Paket: **Probni 10 dana / Basic 1.250 RSD / Premium 2.000 RSD**.
- Firma može uneti PIB knjigovođe tokom registracije ili preskočiti.
- Ako je knjigovođa registrovan, automatski se povezuje kao accountant član firme.
- Ako nije registrovan, čuvaju se PIB/email i pending invitation.
- Kada se taj knjigovođa kasnije registruje istim PIB-om ili emailom, pending klijenti se automatski povezuju.
- Firma može kasnije povezati knjigovođu iz **Više → Poveži knjigovođu**.
- Master dashboard ne računa knjigovodstvene kancelarije kao klijente i ne računa trial naloge u MRR/proviziju.
- Opcioni email poziv knjigovođi preko Resend servisa ako se dodaju `RESEND_API_KEY` i `APP_EMAIL_FROM`.

## 1. Supabase SQL

U Supabase → SQL Editor pokrenite:

`supabase/migrations/005_v4_3_registration.sql`

Očekivano: `Success. No rows returned`.

## 2. APR

APR automatsko popunjavanje radi samo kada postoje Vercel env vrednosti:

- `APR_API_URL`
- `APR_API_TOKEN` (ako ugovoreni API zahteva token)
- opciono `APR_API_TOKEN_HEADER`
- opciono `APR_API_TOKEN_PREFIX`

Ako APR nije konfigurisan, registracija i dalje omogućava ručni unos podataka.

## 3. Email poziv knjigovođi — opciono

Za automatsko slanje poziva emailom dodajte u Vercel:

- `RESEND_API_KEY`
- `APP_EMAIL_FROM` — npr. `FiscalBox <noreply@vasdomen.rs>`

Bez ovih vrednosti PIB/email poziv se i dalje čuva u bazi i automatski će se povezati kada se knjigovođa registruje.

## 4. GitHub / Vercel

Kopirajte SADRŽAJ V4.3 Patch foldera direktno preko lokalnog `fiskalni-inbox-v2` repoa.

GitHub Desktop:

- Summary: `Add V4.3 registration and accountant linking`
- Commit to main
- Push origin

Vercel će automatski pokrenuti deployment.

## 5. Test

1. Otvorite `/register`.
2. Registrujte test Firmu na Probnom paketu.
3. Proverite da se posle registracije otvara `/app`.
4. Registrujte Knjigovođu sa drugim emailom/PIB-om.
5. Kod firme unesite PIB knjigovođe u registraciji ili `Više → Poveži knjigovođu`.
6. Proverite da knjigovođa vidi klijenta na KNJIGO dashboard-u.

## Napomena o trial-u

V4.3 čuva datum isteka 10-dnevnog probnog perioda u bazi. Automatska naplata/checkout još nije implementirana; za naplatu je potreban payment provider u sledećoj fazi.
