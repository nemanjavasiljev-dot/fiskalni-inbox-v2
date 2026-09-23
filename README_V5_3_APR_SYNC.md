# FiscalBox V5.3 — APR pretraga koja radi pouzdano

## Zašto prethodna verzija nije radila

Zvanični APR Open Data endpoint `https://openapi.apr.gov.rs/api/opendata/companies` je ceo snapshot registra, a ne klasičan search endpoint. Zato ga ne treba preuzimati iz svake Vercel pretrage. Snapshot se sada periodično uvozi u Supabase, a aplikacija pretražuje lokalnu centralnu tabelu `companies`.

APR Open Data ne daje PIB kao pouzdan standardni atribut za svaku kompaniju. Za tačan unos PIB-a FiscalBox koristi zvaničnu javnu NBS pretragu samo kao PIB→MB resolver. Kada dobije MB, kompanija se povezuje sa centralnim APR zapisom. Ako APR indeks još nije sinhronizovan, pravi se privremeni centralni zapis označen za APR dopunu; sledeći APR sync ga dopunjava bez duplikata.

## Šta je promenjeno

- `scripts/apr-sync.mjs` — bulk import kompletnog APR snapshot-a u Supabase.
- `.github/workflows/apr-sync.yml` — ručno + dnevno pokretanje APR importa.
- `supabase/migrations/011_v5_3_apr_bulk_sync.sql` — batch upsert RPC + poboljšana srpska normalizacija/pretraga.
- `lib/apr-sync-service.ts` — Vercel više ne skida ceo APR snapshot pri svakoj pretrazi.
- `lib/nbs-company-resolver.ts` — zvanični NBS resolver za PIB/MB/naziv kada lokalni APR indeks nema rezultat.
- `app/api/companies/search/route.ts` — prvo centralna baza, zatim zvanični resolver kao fallback.
- `components/CompanySearch.tsx` — jasno prikazuje APR ili `NBS → APR sync` izvor.
- `app/api/master/apr/sync/route.ts` — Master usmerava bulk APR sync na GitHub Actions.
- `lib/company-registry.ts` — normalizacija ćirilice/latinice za pretragu naziva.

## Deploy — obavezni redosled

### 1. Supabase SQL

Prethodno treba da su uspešno pokrenuti SQL 009 i FIXED SQL 010.

Zatim u Supabase SQL Editor pokreni:

`supabase/migrations/011_v5_3_apr_bulk_sync.sql`

Očekivano: `Success. No rows returned`.

### 2. Kopiraj patch u GitHub repo

Raspakuj V5.3 Patch. Kopiraj SADRŽAJ patch foldera preko lokalnog `fiskalni-inbox-v2` foldera. Nemoj kopirati ceo patch kao podfolder. `.git` ostaje netaknut.

GitHub Desktop:

- Summary: `Fix APR search with bulk sync`
- Commit to main
- Push origin

Vercel će automatski deploy-ovati novi kod.

### 3. Dodaj GitHub Actions secrets

GitHub repo → Settings → Secrets and variables → Actions → New repository secret.

Dodaj:

- `SUPABASE_URL` = isti Project URL koji koristi Vercel `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SECRET_KEY` = server-only Supabase `sb_secret_...` ključ

NIKADA ne stavljaj secret key u repo, `.env.example`, screenshot ili chat.

### 4. Pokreni prvi APR import

GitHub repo → Actions → `APR Open Data Sync` → `Run workflow` → `Run workflow`.

Prvi import obrađuje ceo APR registar i može trajati nekoliko minuta. Kada workflow postane zelen, `companies` tabela sadrži centralni APR indeks.

Dalje se workflow pokreće automatski svaki dan u 03:25 UTC. APR javni dataset se ažurira periodično; ponovni import radi upsert, ne pravi duplikate.

### 5. Test

U registraciji testiraj:

- naziv: `CYBERSHIELD`
- MB: `22074245`
- PIB: `114814160`

Naziv i MB treba da dođu iz centralnog APR indeksa. PIB se, kada nije već poznat u centralnoj bazi, rešava preko zvaničnog NBS registra i povezuje sa istim MB/centralnim zapisom.

## Vercel env

Može ostati:

- `APR_OPEN_DATA_URL=https://openapi.apr.gov.rs/api/opendata/companies`
- `NBS_LOOKUP_TIMEOUT_MS=12000`

`APR_API_*` nije potreban za javni Open Data režim. Ako kasnije dobiješ ugovoreni APR web-servis, `APR_API_*` ima prioritet.

## Arhitektura

`APR Open Data -> GitHub Action sync -> Supabase companies -> FiscalBox backend -> CompanySearch frontend`

Za PIB fallback:

`PIB -> FiscalBox backend -> zvanični NBS registar -> MB -> centralni company_id -> APR sync enrichment`

Frontend nikada direktno ne zove APR/NBS i nikakvi tajni ključevi nisu u browseru.
