# Pokretanje FiscalBox V5.9.1 MERGE

## 0. Backup

Pre produkcije napravite backup Supabase baze i sačuvajte trenutni Vercel deployment.

## 1. SQL redosled za postojeću V5.8.9 instalaciju

Ako ste ranije ručno pokrenuli stari `SQL_017_PRETPLATE_PREDRACUN_BANKA_PREUZMI_SVE.sql`, ne brišite ništa. V5.9.1 je namerno renumerisao nove migracije od 018 naviše.

Pokrenite redom u Supabase SQL Editoru:

1. `SQL_018_SECURITY.sql`
2. `SQL_019_ATOMIC_LEMONSQUEEZY.sql`
3. `SQL_020_COMPANY_CREATION_GUARD.sql`
4. `SQL_021_ACCOUNTANT_ACCESS.sql`
5. `SQL_022_PRETPLATE_PREDRACUN_BANKA_PREUZMI_SVE.sql`
6. `SQL_023_ATOMSKO_RASKNJIZAVANJE_UPLATE.sql`

SQL 022 je idempotentna, renumerisana verzija V5.8.9 billing/bank migracije. Može se ponoviti nakon starog ručnog SQL 017.

Ako ste već pokrenuli originalne V5.9.0 security migracije 017–020, nemojte ih ponavljati samo zato što su ovde renumerisane. U tom slučaju proverite šta je već primenjeno i pokrenite samo nedostajuće 022 i 023.

## 2. MASTER nalog — obavezna promena

Bezbednosna revizija uklanja automatsko kreiranje privilegovanog naloga `MASTER / MASTER`. To je namerno.

Kreirajte/potvrdite stvarni Supabase Auth nalog administratora, zatim u `supabase/MASTER_ADMIN.sql` zamenite `ZAMENITE_SVOJIM_EMAILOM` i pokrenite SQL. Nakon toga se isti javni login koristi za ulazak u MASTER dashboard.

## 3. Vercel env

Obavezno:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `APP_EMAIL_FROM=FiscalBox <noreply@fiscalbox.rs>`

Za javni NBS adapter:
- `NBS_PUBLIC_LOOKUP_ENABLED=true`

Za banku tek kada banka obezbedi API:
- `BANK_PROVIDER`
- `BANK_API_URL`
- `BANK_API_TOKEN`
- `BANK_API_AUTH_HEADER`
- `BANK_API_AUTH_SCHEME`
- `BANK_API_ACCOUNT_ID`
- `BANK_WEBHOOK_SECRET`

## 4. Deploy

Postavite V5.9.1 na GitHub `main`, zatim Vercel redeploy.

## 5. Obavezni smoke test

1. Login običnog USER naloga.
2. Registracija / PIB / ručni unos.
3. Slanje i prihvatanje USER ↔ knjigovođa zahteva.
4. Izbor Basic/Premium → kreiran predračun → email → Neplaćeno.
5. MASTER ručna verifikacija predračuna → finalni račun → Plaćeno.
6. MASTER eksplicitno suspenduje test firmu; provera da uplata ne skida suspenziju.
7. Knjigovođa → Preuzmi sve račune / dokumente za aktivnog klijenta.
8. Blokirajte vezu knjigovođa-klijent; proverite da masovno preuzimanje više nije dozvoljeno.
9. `npm test`, `npm run check:syntax`, `npm run typecheck`, `npm run build`.

## Napomena

Generički bank adapter nije specifična integracija sa konkretnom bankom dok ne dobijete njihove zvanične API podatke. Manualna MASTER verifikacija uplate radi bez bank API-ja.
