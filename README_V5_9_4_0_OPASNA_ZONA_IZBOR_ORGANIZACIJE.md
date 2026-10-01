# FiscalBox V5.9.4.0 – OPASNA ZONA izbor organizacije iz baze

## Izmena
U SUPER ADMIN editoru organizacije, u delu **OPASNA ZONA**, ručni unos punog naziva kao potvrda je zamenjen sigurnijim izborom organizacije iz FiscalBox baze.

- pretraga radi po nazivu, PIB-u ili matičnom broju;
- rezultati prikazuju naziv, tip (FIRMA/KNJIGOVOĐA), PIB i MB;
- SUPER ADMIN mora da izabere rezultat iz ponuđene liste;
- brisanje je omogućeno samo ako je izabrana organizacija ista ona koja je trenutno otvorena za editovanje;
- ako je izabrana druga organizacija, sistem jasno upozorava i blokira brisanje;
- završna potvrda `OBRISI` ostaje obavezna;
- postojeća serverska DELETE zaštita i audit log ostaju nepromenjeni.

## Baza
Nema nove SQL migracije. Poslednja obavezna migracija ostaje `SQL_032_SUPER_ADMIN_EDIT_MARKETING_APR_EMAIL.sql`.

## Provera
- package verzija: 5.9.4.0
- 188 TS/TSX fajlova
- 0 sintaksnih grešaka
- ciljani assertions za OPASNU ZONU: OK
