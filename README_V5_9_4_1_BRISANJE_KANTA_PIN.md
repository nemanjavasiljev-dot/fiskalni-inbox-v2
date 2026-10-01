# FiscalBox V5.9.4.1 — Brisanje iz liste, kanta + PIN

## SUPER ADMIN

Brisanje organizacije je uklonjeno iz editora / „OPASNE ZONE“.

Na listi **Registrovane firme** i listi **Registrovane knjigovođe**, pored dugmeta „Otvori / edituj“, sada postoji crveno dugme sa ikonom kante.

Tok brisanja:

1. SUPER ADMIN klikne na kantu pored konkretne firme ili knjigovođe.
2. Sistem prikazuje jasno upozorenje šta će biti trajno obrisano i traži potvrdu.
3. Posle potvrde sistem traži SUPER ADMIN PIN.
4. Podrazumevani PIN je `5203` i validira se isključivo na serveru. Browser ne zna očekivani PIN.
5. Opcionalno se na serveru može postaviti `MASTER_DELETE_PIN`; ako nije postavljen, koristi se `5203`.
6. Tek nakon uspešne server-side PIN provere organizacija se trajno briše.

## Šta se briše

Za firmu se briše FiscalBox organizacija i svi vezani podaci koji imaju `ON DELETE CASCADE`: članstva, fiskalni računi, dokumenti, pretplata, billing dokumenti i druge organizacione veze. Privatni storage prefiksi se zatim čiste iz `documents`, `receipt-images` i `organization-assets`. Auth korisnici koji više ne pripadaju nijednoj drugoj organizaciji takođe se brišu. Deljeni korisnici ostaju.

Za knjigovodstvenu organizaciju briše se sama agencija, njeni vezani podaci i veze sa klijentima; **klijentske firme ostaju u FiscalBox bazi**.

Centralni APR / `companies` registar se ne briše, jer predstavlja nezavisni poslovni registar, a ne FiscalBox korisnički nalog.

## Bezbednost

- Endpoint ostaje dostupan samo `master_admin` korisniku preko `requireMaster()`.
- PIN se šalje samo u DELETE zahtevu i proverava na serveru.
- Pogrešan PIN vraća HTTP 403 i ne menja bazu.
- SUPER ADMIN ne može ovim putem obrisati sopstveni master nalog.
- Uspešno brisanje ostavlja audit zapis `organization_deleted` u `master_action_log`.

## Baza

Nema nove SQL migracije. Poslednja obavezna migracija ostaje `SQL_032_SUPER_ADMIN_EDIT_MARKETING_APR_EMAIL.sql`.
