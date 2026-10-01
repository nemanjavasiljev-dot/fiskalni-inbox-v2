# FiscalBox V5.9.3.3 — QR Status računa

Ova verzija je nadogradnja V5.9.3.2 i menja način prikaza rezultata QR skeniranja.

## Urađeno

- Sirovi sadržaj fiskalnog QR koda više se ne prikazuje korisniku.
- Dugačak link Poreske uprave se ne prikazuje u rezultatu skeniranja.
- Tehnički naziv QR engine-a (`QR Scanner Worker`, `ZXing`, `jsQR`, `BarcodeDetector`) više se ne prikazuje preko kamere.
- Poruke skenera su pomerene ispod kamere umesto preko video prikaza.
- Posle skeniranja prikazuje se nova kartica **Status računa**.

Kartica prikazuje:

- validnost računa: **Validan / Nevalidan / Nije potvrđen**;
- PIB kupca: pronađen PIB, **Nije pronađen** ili **Nije potvrđen** ako provera nije završena;
- AI PDV predlog: **Može da se koristi / Ne može da se koristi / PROVERA**;
- korisnu napomenu;
- dobavljača i iznos kada su dostupni;
- jasno upozorenje ako račun već postoji u bazi.

Ako račun nema PIB kupca, i dalje ostaje postojeći korak u kome korisnik bira da li želi da ga ipak sačuva u arhivu.

## Baza

Nema nove SQL migracije. I dalje se koristi:

`SQL_029_QR_DUPLIKATI_PIB_GATE.sql`

odnosno migracija:

`supabase/migrations/029_v5_9_3_2_qr_duplicates_pib_gate.sql`
