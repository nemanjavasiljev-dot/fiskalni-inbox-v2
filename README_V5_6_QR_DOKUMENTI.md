# FiscalBox V5.6 — QR i dokumenti

## Šta je promenjeno

- QR skener koristi brzi nativni `BarcodeDetector` kada ga browser podržava, uz `jsQR` fallback.
- Kamera se skenira u kratkim intervalima radi boljih performansi i manje potrošnje baterije.
- Podržano je očitavanje bilo kog QR sadržaja (link, tekst, Wi‑Fi, kontakt, email, telefon, lokacija...).
- Fiskalni QR sa domena Poreske uprave se automatski proverava i čuva kao fiskalni račun.
- Ostali QR kodovi se očitaju i prikažu, ali se ne upisuju kao fiskalni račun.
- Dodata je opcija učitavanja fotografije QR koda.
- Kada uređaj podržava lampu/torch, prikazuje se dugme za blic.

## Skeniranje dokumenata

- Nakon fotografisanja skener automatski traži ivice dokumenta i kropuje kadar kada je rezultat pouzdan.
- Pre čuvanja se prikazuje pregled.
- Korisnik obavezno može da upiše/promeni naziv dokumenta pre čuvanja.
- Ako automatski krop nije pouzdan, čuva se ceo kadar umesto agresivnog pogrešnog sečenja.

## Fotografisanje

- Posle fotografisanja aplikacija traži samo naziv fotografije.
- Tek nakon potvrde naziv se koristi za fajl i dokument se čuva.

## Dodavanje fajla

- Pre slanja aplikacija pita da li korisnik želi da zadrži originalni naziv ili da preimenuje dokument.
- Radi i za više fajlova odjednom; svaki fajl se može preimenovati zasebno.

## Baza

Nema nove SQL migracije. V5.6 koristi postojeću `documents` tabelu i storage bucket.
