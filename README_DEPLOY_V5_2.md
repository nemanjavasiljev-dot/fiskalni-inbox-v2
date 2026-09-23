# FiscalBox V5.2 deploy

1. Baza mora imati primenjen SQL 009 i ispravljeni SQL 010 iz `supabase/migrations/010_v5_1_central_companies_apr.sql`.
2. Raspakujte patch i kopirajte njegov sadržaj direktno preko postojećeg FiscalBox projekta.
3. U Vercel-u APR Open Data može raditi bez tajnog ključa. Opciono dodajte:
   - `APR_OPEN_DATA_URL=https://openapi.apr.gov.rs/api/opendata/companies`
   - `APR_OPEN_DATA_TIMEOUT_MS=60000`
   - `APR_OPEN_DATA_CACHE_MS=21600000`
4. Commit: `FiscalBox V5.2 APR Open Data registration`
5. Push origin i sačekajte Vercel build.

Promene:
- registracija: nema ime/prezime i nema ručnog username-a;
- firma se bira prva po PIB-u ili nazivu;
- username se automatski generiše iz naziva firme, sa jedinstvenim sufiksom ako je potrebno;
- login prihvata username ili email;
- backend koristi zvanični APR Open Data snapshot kao podrazumevani izvor i upisuje rezultate u centralnu `companies` tabelu;
- ugovoreni APR_API_* servis, ako se kasnije podesi, ima prioritet nad Open Data izvorom.
