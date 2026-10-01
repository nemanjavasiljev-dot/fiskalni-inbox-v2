# Validacija FiscalBox V5.9.3.8

Datum pakovanja: 2026-09-30

## Provere koje su izvršene

- TypeScript/TSX transpile sintaksna provera preko TypeScript 5.8.3: **187 fajlova / 0 sintaksnih grešaka**.
- `node --check scripts/apr-sync.mjs`: OK.
- `node --check scripts/apr-sync-all.mjs`: OK.
- Custom assertions za V5.9.3.8 funkcije: 12/12 OK.
- Provereno da paket ne sadrži `.env`, `.env.local` ni `.env.production` fajl sa tajnama.

## npm test

`npm test` je pokrenut, ali nije mogao da izvrši regression suite jer source paket nema instaliran `node_modules`, pa runtime ne nalazi zavisnost `web-push`.

To nije TypeScript sintaksna greška u V5.9.3.8. Na razvojnom ili deployment računaru obavezno pokrenuti:

```bash
npm install
npm run check:syntax
npm test
npm run build
```

## Baza

V5.9.3.8 zahteva novu migraciju:

`SQL_032_SUPER_ADMIN_EDIT_MARKETING_APR_EMAIL.sql`

Pokrenuti je posle `SQL_031_FOTO_FISKALNI_FALLBACK.sql`, pre pokretanja nove aplikacije.

## APR preduzetnici

Kod i baza podržavaju `registry_kind=entrepreneur` i registrovani email. Bulk sinhronizacija privrednih društava koristi postojeći APR Open Data endpoint. Za preduzetnike je namerno ostavljena konfiguraciona promenljiva `APR_OPEN_DATA_ENTREPRENEURS_URL`, jer aplikacija ne sme da hardkoduje/neovlašćeno scrape-uje neproveren APR URL. Ako se koristi ugovoreni APR web-servis, `APR_API_SEARCH_URL` / `APR_API_URL` može vraćati oba tipa subjekata i parser će prepoznati preduzetnika i email.
