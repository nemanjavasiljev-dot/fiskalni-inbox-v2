# FiscalBox V5.8.5 — MASTER superadmin

## Šta je dodato

- FiscalBox vlasnički/superadmin nalog koristi **isti `/login`** kao firma i knjigovođa.
- Ne postoji poseban MASTER login ekran.
- Početni kredencijali su:
  - username: `MASTER`
  - password: `MASTER`
- Pri prvom uspešnom unosu `MASTER / MASTER`, ako u bazi još ne postoji nijedan `master_admin`, backend automatski kreira produkcioni Supabase Auth nalog i profil sa ulogom `master_admin`.
- Ako master nalog već postoji, bootstrap se više nikada ne ponavlja, čak i ako kasnije promenite username.
- Nakon prijave MASTER se automatski vodi na postojeći FiscalBox Control Center dashboard.
- U sidebar je dodat meni **Superadmin nalog**.
- Unutar njega MASTER može promeniti svoje korisničko ime i lozinku.
- Promena zahteva unos trenutne lozinke.
- Lozinka ostaje u Supabase Auth sistemu i ne čuva se kao plaintext u FiscalBox tabelama.

## Važno pre produkcije

`MASTER / MASTER` je namerno početna kombinacija na zahtev vlasnika aplikacije i nije bezbedna za trajnu upotrebu.

Pre javnog puštanja aplikacije:

1. deploy V5.8.5;
2. odmah otvorite `/login`;
3. prijavite se sa `MASTER / MASTER`;
4. otvorite **Superadmin nalog**;
5. promenite username i lozinku;
6. tek nakon toga delite produkcioni URL korisnicima.

## SQL

Za V5.8.5 nema novog SQL-a. Koristi postojeću `profiles.global_role = 'master_admin'` infrastrukturu i Supabase Auth.
