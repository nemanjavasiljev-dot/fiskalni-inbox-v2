# FiscalBox V5.5 — PIB CompanyLookup

## Šta je novo

- PIB je primarni unos kompanije.
- Kada korisnik unese 9 cifara, `/api/company-lookup?pib=...` automatski pokreće proveru.
- Backend koristi zvanični NBS CompanyAccount SOAP servis kada su NBS kredencijali podešeni.
- Dobijeni matični broj se povezuje sa postojećom lokalnom APR bazom (`public.companies`).
- Kompanija zadržava jedan centralni `company_id` i ne duplira se po modulima.
- Rezultat se kešira 24h (`COMPANY_REGISTRY_CACHE_MS`).
- Ako NBS nije konfigurisan ili privremeno nije dostupan, korisnik može odmah da nastavi postojećom APR pretragom po nazivu ili MB.
- `CompanyLookup` je reusable komponenta i koristi se na registraciji, setup-u, dodavanju klijenta, povezivanju knjigovođe i administratorskim izborima firme.
- Supabase URL se normalizuje server/client-side, pa slučajno unet `/rest/v1` ili druga putanja ne lomi Supabase klijenta.

## 1. Supabase

U Supabase SQL Editor-u pokrenuti ceo fajl:

`SQL_013_PIB_COMPANY_LOOKUP.sql`

Migracija dodaje NBS/cache kolone u postojeću `public.companies` tabelu. Postojećih APR 133k+ firmi se ne briše.

## 2. Vercel Environment Variables

Postojeće promenljive ostaju:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

Za stvarnu PIB -> NBS proveru dodati serverske promenljive:

- `NBS_USERNAME`
- `NBS_PASSWORD`
- `NBS_LICENCE_ID`
- `NBS_COMPANY_ACCOUNT_URL=https://webservices.nbs.rs/CommunicationOfficeService1_0/CompanyAccountXmlService.asmx`
- `NBS_LOOKUP_TIMEOUT_MS=12000`
- `COMPANY_REGISTRY_CACHE_MS=86400000`

NBS vrednosti **ne smeju** imati `NEXT_PUBLIC_` prefiks.

## 3. Ako NBS kredencijali još nisu dobijeni

Aplikacija neće izmišljati podatke niti koristiti lažni endpoint. PIB automatska provera će prikazati da trenutno nije aktivirana i odmah otvoriti rezervnu APR pretragu po nazivu ili matičnom broju. Ostatak aplikacije i registracija ostaju upotrebljivi.

## 4. Deployment

1. Pokrenuti SQL 013.
2. Upload/commit V5.5 na GitHub `main`.
3. Dodati NBS env varijable u Vercel kada ih NBS dostavi.
4. Redeploy poslednjeg deployment-a.
5. Testirati `/register`:
   - unesite PIB od 9 cifara;
   - proverite loader „Pretražujemo zvanične registre…“;
   - kada NBS radi, očekuje se naziv + PIB + MB i badge „Zvanični registri“;
   - bez NBS kredencijala, očekuje se fallback na naziv/MB bez blokiranja registracije.

## 5. Bezbednost

- NBS kredencijali se koriste isključivo na backendu.
- API ima postojeći rate-limit mehanizam iz centralnog company registra.
- Eksterni poziv ima timeout.
- Ne loguju se NBS lozinka ni LicenceID.
- NBS odgovor se normalizuje pre upisa; u `nbs_raw` se čuvaju samo izdvojena polja potrebna aplikaciji, ne kompletna lista računa.
