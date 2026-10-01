# FiscalBox V5.9.3.8 — SUPER ADMIN: organizacije, APR preduzetnici/email, marketing

Osnova: V5.9.3.7.

## SUPER ADMIN — firme

- Svaka firma u listi ima `Otvori / edituj`.
- MASTER može da menja naziv, PIB, MB, pravnu formu, adresu, opštinu/mesto, delatnost, kontakt email i telefon.
- Za firme MASTER može da promeni BASIC/PREMIUM plan; promena se upisuje u `organizations.plan` i postojeći `subscriptions.plan`.
- U editoru se vide vlasnik, zaposleni i njihova prava.
- MASTER može da doda novog ili postojećeg FiscalBox korisnika kao zaposlenog i da mu dodeli `ADMIN` ili `USER` prava.
- Novi nalog dobija potvrđen email i generisane kredencijale; lozinka se prikazuje samo MASTER-u nakon kreiranja i ne skladišti se čitljivo u bazi.
- `ADMIN` zaposleni firme dobija owner-like administrativna prava preko `organization_access_role` / `is_org_owner` tamo gde aplikacija koristi postojeću ownership autorizaciju.

## SUPER ADMIN — knjigovođe

- Svaka knjigovodstvena organizacija ima `Otvori / edituj`.
- Menjaju se osnovni podaci agencije i zaposleni; knjigovođa i dalje nema sopstvenu pretplatu.
- MASTER može da doda zaposlenog i dodeli `ADMIN` / `USER` privilegiju.
- Kod knjigovodstvene organizacije `organization_access_role` i postojeći `accounting_access_role` ostaju sinhronizovani.
- Novi zaposleni knjigovođe dobija `global_role=accountant`; pri uklanjanju se uklanjaju i njegove dodele klijentima, a nalog se ne briše.

## APR / Firme — preduzetnici i email

- Centralna `companies` baza već razlikuje `company` i `entrepreneur`; V5.9.3.8 sada čuva i `contact_email` kada ga APR izvor vrati.
- Pretraga prikazuje da li je rezultat APR društvo ili APR preduzetnik i prikazuje `Email iz registra` kada postoji.
- Bulk sinhronizacija ima novi `npm run sync:apr:all`, koji sinhronizuje privredna društva i zatim preduzetnike.
- Javni APR Open Data endpoint za privredna društva ostaje `APR_OPEN_DATA_COMPANIES_URL`.
- Za posebni bulk feed/API preduzetnika treba podesiti `APR_OPEN_DATA_ENTREPRENEURS_URL`. Ne hardkoduje se neproveren endpoint.
- Ako se koristi ugovoreni APR API (`APR_API_SEARCH_URL` / `APR_API_URL`), parser prepoznaje i preduzetnika i email, uključujući email u ugnježdenom JSON-u.

Primer `.env`:

```env
APR_OPEN_DATA_COMPANIES_URL=https://openapi.apr.gov.rs/api/opendata/companies
APR_OPEN_DATA_ENTREPRENEURS_URL=
```

## Komunikacija — Marketing

U MASTER > Komunikacija dodat je odeljak `MARKETING`:

- naziv kampanje,
- naslov emaila,
- reklamna poruka,
- do 5 attachment fajlova,
- do 10 MB po fajlu / 20 MB ukupno po kampanji,
- podržani PDF, JPG/PNG/WEBP, TXT, CSV, DOCX i XLSX,
- slanje koristi primaoce iz postojećeg izbora u Komunikaciji,
- email primaoca se bira redom: kontakt email organizacije -> APR/centralni-registar email povezane firme -> email vlasnika naloga,
- istorija kampanja se čuva u `marketing_campaigns`, a fajlovi u privatnom `marketing-assets` storage bucket-u.

Za email slanje i dalje moraju biti podešeni `RESEND_API_KEY` i `APP_EMAIL_FROM`.

## Obavezna baza

Pre pokretanja V5.9.3.8 izvršiti **posle SQL_031**:

```text
SQL_032_SUPER_ADMIN_EDIT_MARKETING_APR_EMAIL.sql
```

Isti SQL postoji i kao:

```text
supabase/migrations/032_v5_9_3_8_super_admin_marketing_apr_email.sql
```

Migracija dodaje:

- APR kontakt email kolone u `companies`,
- `organization_access_role` u `organization_members`,
- MASTER marketing kampanje i attachment metapodatke,
- privatni storage bucket `marketing-assets`,
- proširenje `master_notification_log`,
- prošireni APR bulk upsert za `registry_kind` + `contact_email`.

## Provera

- TypeScript/TSX sintaksna transpile provera: 187 fajlova, 0 sintaksnih grešaka.
- `scripts/apr-sync.mjs` i `scripts/apr-sync-all.mjs`: `node --check` prolazi.
- Fizički production build/test treba pokrenuti na razvojnom/server računaru nakon `npm install`:

```bash
npm install
npm run check:syntax
npm test
npm run build
```
