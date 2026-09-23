# FiscalBox V5.8.8 — jednostavno povezivanje USER ↔ knjigovođa

## Novi sistem

Povezivanje firme i knjigovođe je svedeno na minimum.

### Firma šalje zahtev knjigovođi
1. Izabere **Email** ili **SMS**.
2. Unese samo email adresu ili broj telefona knjigovođe.
3. FiscalBox šalje obaveštenje.
4. Knjigovođa se prijavljuje u FiscalBox.
5. U dashboardu vidi **Novi zahtev** i bira **Prihvati** ili **Odbij**.
6. Tek prihvatanjem firma postaje njegov klijent.

### Knjigovođa šalje zahtev firmi
1. Klikne **Pošalji zahtev**.
2. Izabere **Email** ili **SMS**.
3. Unese samo email ili telefon klijenta.
4. Firma dobija obaveštenje.
5. Firma se prijavljuje i prihvata zahtev u svom dashboardu.
6. Tek tada se aktivira veza sa knjigovođom.

## Važna promena

Email i SMS više **ne prihvataju vezu direktno** i nema verifikacionog dugmeta koje automatski dodaje klijenta. Poruka samo obaveštava primaoca i vodi ga na FiscalBox dashboard. Prihvatanje je uvek unutar prijavljenog naloga.

## SQL

Pre deploy-a pokrenite:

`SQL_016_JEDNOSTAVNI_ZAHTEVI_POVEZIVANJE.sql`

Migracija dodaje tabelu `connection_requests`.

## Email

Za email pozive u Vercel-u moraju postojati:

- `RESEND_API_KEY`
- `APP_EMAIL_FROM=FiscalBox <noreply@fiscalbox.rs>`

## SMS

Za SMS pozive u Vercel-u moraju postojati:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

Ako SMS servis nije podešen, FiscalBox jasno prijavljuje grešku i zahtev se ne ostavlja kao poslat.

## Napomena za SMS

Ako primalac još nema FiscalBox nalog, broj telefona mora kasnije biti isti kao kontakt telefon njegove organizacije da bi zahtev mogao automatski da se prikaže u dashboardu. Email je zato najjednostavniji kanal za nove korisnike.
