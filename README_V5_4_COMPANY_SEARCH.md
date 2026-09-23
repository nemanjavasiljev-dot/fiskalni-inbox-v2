# FiscalBox V5.4 — APR pretraga po nazivu i matičnom broju

Ova verzija koristi lokalno sinhronizovanu APR `companies` tabelu i pretražuje samo:

- naziv firme
- matični broj (MB)

PIB nije deo registracione APR pretrage.

## Obavezno posle deploy-a

U Supabase SQL Editor pokrenuti:

`supabase/migrations/012_v5_4_company_search_name_mb.sql`

Migracija uklanja stare overload verzije `search_companies`, kreira jednu kompatibilnu RPC funkciju `search_companies(text, integer)` i daje EXECUTE pravo `service_role` roli koju koristi serverski API.

## Test

- naziv: `tempo`
- MB: `17000454`

Registracija i povezivanje knjigovođe koriste istu komponentu `CompanySearch`.
