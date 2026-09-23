# FiscalBox V5.1 — centralni APR / CompanySearch

Ova verzija radi na postojećoj V5 aplikaciji. Ne uvodi novu demo aplikaciju niti menja postojeću funkcionalnu arhitekturu. Cilj je jedan centralni identitet firme (`company_id`) i jedna reusable `CompanySearch` komponenta kroz registraciju, knjigovođu, firmu i Master Admin.

## Šta je promenjeno

- centralna tabela `companies` sa UNIQUE matičnim brojem i PIB indeksom;
- `company_id` dodat na organizacije, profile, račune, dokumente, pretplate, billing dokumente i pozive;
- migracija postojećih organizacija: MB → PIB → naziv; nesigurni slučajevi idu u `company_migration_review`;
- `CompanySearch` autocomplete: naziv / PIB / MB, debounce 400 ms, max 15 rezultata, exact MB/PIB prvi;
- browser nikad ne zove APR direktno: frontend → FiscalBox `/api/companies/*` → centralna baza / `APRSyncService` → ugovoreni APR web-servis;
- registracija više ne prihvata ručno APR ime/PIB/MB;
- ako firma već postoji, ne pravi se novi tenant nego `company_access_requests` zahtev;
- knjigovođa koristi CompanySearch u `+ Dodaj firmu`; postojeća firma dobija zahtev za povezivanje;
- posebna centralna relacija `accountant_company` sa `pending/active/rejected/blocked`;
- firma može iz svog naloga da prihvati/odbije zahtev korisnika ili knjigovođe;
- Master Admin dobija `APR / Firme`, statistiku i ručnu sinhronizaciju;
- Master billing, izdavalac i pojedinačna komunikacija koriste CompanySearch umesto slobodnog unosa kompanije;
- APR polja su prikazana kao zaključani podaci sa oznakom „Podaci iz APR-a“ i opcijom osvežavanja gde je dozvoljeno.

## DB migracija

Pokrenuti u Supabase SQL Editor-u:

`supabase/migrations/010_v5_1_central_companies_apr.sql`

Migracija ne briše stare organizacije, račune, dokumente, pretplate ili veze. Legacy `organization_id` ostaje za tenant/RLS kompatibilnost, ali centralni identitet pravnog lica je `company_id`.

## APR konfiguracija

APR ugovoreni endpoint i njegov schema nisu hardkodovani. Postavite serverske vrednosti u Vercel-u prema dokumentaciji/ugovoru koji dobijete od APR-a:

- `APR_API_SEARCH_URL`
- `APR_API_DETAIL_URL`
- opciono `APR_API_URL`
- `APR_API_METHOD`
- `APR_API_QUERY_PARAM`
- `APR_API_TIMEOUT_MS`
- `APR_API_TOKEN`
- `APR_API_TOKEN_HEADER`
- `APR_API_TOKEN_PREFIX`
- ili `APR_API_USERNAME` + `APR_API_PASSWORD`

APR tajne nikada nemojte stavljati u `NEXT_PUBLIC_*` promenljive ili frontend kod.

Ako APR još nije konfigurisan, aplikacija pretražuje postojeću centralnu FiscalBox bazu. Pretraga potpuno novih firmi iz APR-a tada jasno javlja da web-servis nije konfigurisan; nema mock odgovora i nema scraping-a.

## Centralne API rute

- `GET /api/companies/search?q=`
- `GET /api/companies/[id]`
- `POST /api/companies/[id]/refresh`
- `GET /api/companies/registration-number/[registrationNumber]`
- `GET /api/master/apr/stats`
- `POST /api/master/apr/sync`

Kompatibilne stare `/api/apr/lookup` rute su samo wrapper prema istom `APRSyncService`, ne sadrže odvojenu APR implementaciju.

## Zaštita od duplikata i preuzimanja firme

- `companies.registration_number` ima unique partial index;
- `companies.pib` ima unique partial index;
- ako postoji FiscalBox organizacija za `company_id`, registracija ne kreira novu;
- novi korisnik dobija pending zahtev i tek postojeći administrator daje pristup;
- knjigovođa ne dobija postojeću firmu automatski: firma prihvata/odbija vezu.

## Lokalno pokretanje

```bash
npm install
npm run build
npm run dev
```

## Smoke test pretrage

Posle pokretanja aplikacije:

```bash
TEST_APP_URL=http://localhost:3000 \
TEST_APR_NAME="UNITED WEB" \
TEST_APR_EXACT_NAME="UNITED WEB VISION DOO SUBOTICA" \
TEST_APR_MB="VAS_TEST_MB" \
TEST_APR_PIB="VAS_TEST_PIB" \
npm run test:apr-smoke
```

Koristite stvarne testne MB/PIB vrednosti koje imate pravo da proveravate preko ugovorenog APR servisa.

## Test matrica

1. deo naziva → autocomplete;
2. tačan naziv;
3. MB → exact rezultat prvi;
4. PIB → exact rezultat prvi kada ga APR izvor daje;
5. nepostojeća firma → jasna poruka, bez tehničkog stack-a;
6. firma već postoji → isti `company_id`;
7. pokušaj duple registracije → zahtev za pristup, bez novog org zapisa;
8. knjigovođa dodaje novu firmu → pending potencijalni klijent/poziv;
9. knjigovođa dodaje postojeću firmu → `accountant_company=pending`;
10. firma prihvata vezu → active + kompatibilna accountant membership veza;
11. firma odbija zahtev → rejected;
12. Master bira firmu preko CompanySearch;
13. APR nije dostupan → koristi lokalne podatke ili korisničku poruku;
14. mobilni dropdown/search prikaz.

## Ključni promenjeni/dodati fajlovi

- `components/CompanySearch.tsx`
- `lib/company-registry.ts`
- `lib/apr-sync-service.ts`
- `lib/apr.ts`
- `app/api/companies/**`
- `app/api/master/apr/**`
- `app/api/company-access-requests/[id]/route.ts`
- `app/api/accountant-company/[id]/route.ts`
- `app/register/register-form.tsx`
- `app/api/register/route.ts`
- `app/app/setup/setup-form.tsx`
- `app/api/org/create/route.ts`
- `app/app/accountant-home.tsx`
- `app/api/accountant/clients/invite/route.ts`
- `app/api/client-invite/accept/route.ts`
- `app/api/org/accountant-link/route.ts`
- `app/app/ui.tsx`
- `app/app/page.tsx`
- `app/app/master-admin.tsx`
- `app/globals.css`
- `.env.example`
- `supabase/migrations/010_v5_1_central_companies_apr.sql`
- `tests/apr-company-search-smoke.mjs`

## Važno

Pravi APR live rezultat zavisi od ugovorenog APR web-servisa i njegovih kredencijala. Ova verzija ne izmišlja produkcioni APR endpoint niti koristi scraping. Po dobijanju APR ugovorne tehničke specifikacije, unesite `.env` vrednosti i po potrebi prilagodite mapiranje aliasa u `lib/apr-sync-service.ts` tačno toj šemi.
