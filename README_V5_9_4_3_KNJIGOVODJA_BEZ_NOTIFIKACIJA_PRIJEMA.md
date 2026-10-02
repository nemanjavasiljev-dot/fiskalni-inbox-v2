# FiscalBox V5.9.4.3 — KNJIGOVOĐA bez notifikacija za prijem

## Izmena
- Novi fiskalni računi koji stignu knjigovođi više ne kreiraju push, toast niti zapis u centru obaveštenja samo zbog prijema.
- Novi dokumenti/fajlovi koje klijent pošalje knjigovođi više ne kreiraju push, toast niti zapis u centru obaveštenja samo zbog prijema.
- KNJIGO dashboard i dalje prikazuje brojače **Novi računi** i **Novi dokumenti** i kompletan prijemni tok ostaje nepromenjen.
- Bell/notifikacioni panel ostaje za zahteve za povezivanje i druge sistemske događaje.
- U podešavanjima knjigovođe uklonjeni su prekidači za „Novi računi“ i „Novi dokumenti“, jer te vrste događaja više nisu notifikacije.
- Podešavanje rokova ostaje.

## Baza
Nema nove SQL migracije. Poslednja obavezna migracija ostaje SQL_032.

## Vercel/GitHub
Nakon commit/push-a Vercel treba da uradi novi build/deploy.
