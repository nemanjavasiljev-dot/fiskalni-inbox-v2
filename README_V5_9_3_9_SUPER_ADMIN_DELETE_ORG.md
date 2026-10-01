# FiscalBox V5.9.3.9 — SUPER ADMIN trajno brisanje firme / knjigovođe

## Izmena
SUPER ADMIN u editoru svake organizacije sada ima OPASNU ZONU sa mogućnošću trajnog brisanja firme ili knjigovođe iz FiscalBox baze.

## Zaštita od slučajnog brisanja
Za brisanje je potrebno:
1. otvoriti organizaciju kroz **Otvori / edituj**,
2. upisati tačan naziv organizacije,
3. upisati `OBRISI`,
4. potvrditi dodatni browser dijalog.

## Šta se briše
Brisanjem organizacije kaskadno se uklanjaju podaci vezani za tu organizaciju: članstva, fiskalni računi, dokumenti, pretplata, predračuni/računi i veze knjigovođa-klijent koje su vezane FK pravilima.

Pre brisanja baze aplikacija čisti storage prefikse organizacije iz bucket-a:
- `documents`
- `receipt-images`
- `organization-assets`

Nakon brisanja organizacije brišu se i Supabase Auth korisnici vlasnika/zaposlenih samo ako više nisu član niti vlasnik druge organizacije i nisu `master_admin`. Deljeni korisnički nalozi se zadržavaju.

Kod brisanja knjigovodstvene organizacije njeni klijenti se NE brišu — brišu se samo veze sa tom knjigovodstvenom organizacijom.

Audit zapis `organization_deleted` ostaje u `master_action_log`; nakon FK `ON DELETE SET NULL` detalji i ID obrisane organizacije ostaju sačuvani u JSON detaljima.

## Baza
Nema novog SQL-a. Funkcija koristi postojeće `ON DELETE CASCADE / SET NULL` veze iz aktuelne baze. Poslednja obavezna migracija ostaje SQL_032 iz V5.9.3.8.

## APR centralni registar
Brisanje FiscalBox naloga firme ne briše odgovarajući zapis iz centralne APR/companies baze. To je namerno: `companies` je registar/cache izvora, a `organizations` je FiscalBox korisnički nalog. Firma se zato kasnije može ponovo registrovati bez ponovnog ručnog unošenja APR podataka.
