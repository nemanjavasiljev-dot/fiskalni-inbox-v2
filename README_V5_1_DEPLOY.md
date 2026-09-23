# FiscalBox V5.1 Production + Central APR — Deploy

Ovo je produkciona FiscalBox verzija bez javnog demo režima. Uključuje realan Supabase login/registraciju, 10-dnevni trial za Basic/Premium, produkcioni subscription adapter i centralni APR/CompanySearch sistem.

## 1. Baza

Ako je poslednja migracija u Supabase-u `008_v4_6_master_admin.sql`, pokrenite redom:

1. `supabase/migrations/009_v5_production_subscriptions.sql`
2. `supabase/migrations/010_v5_1_central_companies_apr.sql`

Ako je `009` već pokrenuta, pokrenite samo `010`.

Migracija 010 ne briše postojeće firme/račune/dokumente. Pravi centralnu tabelu `companies`, pokušava migraciju MB -> PIB -> naziv i nesigurne veze stavlja u `company_migration_review`.

## 2. Vercel env

Obavezno postojeći Supabase:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `NEXT_PUBLIC_APP_URL`

Produkcione pretplate (Lemon Squeezy):

- `LEMONSQUEEZY_API_KEY`
- `LEMONSQUEEZY_STORE_ID`
- `LEMONSQUEEZY_BASIC_VARIANT_ID`
- `LEMONSQUEEZY_PREMIUM_VARIANT_ID`
- `LEMONSQUEEZY_WEBHOOK_SECRET`

APR — tačne vrednosti iz APR ugovora/tehničke specifikacije:

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

Opciono / postojeće integracije:

- `RESEND_API_KEY`
- `APP_EMAIL_FROM`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `CRON_SECRET`

APR tajne nikada ne stavljati u `NEXT_PUBLIC_*` niti u GitHub.

## 3. GitHub / Vercel

Kopirajte sadržaj ZIP-a u postojeći repo, Commit/Push na `main`, pa sačekajte Vercel build.

Pre puštanja korisnicima proverite registraciju firme, registraciju knjigovođe, 10-day trial, login/recovery, CompanySearch, zaštitu postojeće firme, povezivanje knjigovođa-firma, Master APR/Firme i checkout/webhook.

## 4. Centralni APR tok

Frontend koristi samo FiscalBox backend:

`CompanySearch -> /api/companies/* -> companies baza -> APRSyncService -> ugovoreni APR web-servis`

Nema direktnog APR poziva iz browsera, nema scraping-a i nema mock firmi kao produkcionog fallback-a.

## 5. Važno za APR

Pošto javne APR stranice ne objavljuju konkretan ugovoreni produkcioni endpoint i schema, aplikacija ne izmišlja URL. Kada dobijete APR tehničku specifikaciju, unesite env vrednosti. Ako se naziv polja u APR JSON-u razlikuje, prilagoditi alias mapping u `lib/apr-sync-service.ts`.

## 6. Provera koda

Interna TypeScript/sintaksna provera je prošla pre pakovanja. Puni `npm install && npm run build` nije mogao biti izvršen u ovom radnom okruženju jer npm download nije završio u vremenskom ograničenju; konačni build treba potvrditi na Vercel-u.
