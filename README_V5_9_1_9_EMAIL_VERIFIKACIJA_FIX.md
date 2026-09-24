# FiscalBox V5.9.1.9 — Email verifikacija registracije

- Verifikacioni email preko Resend-a ima 3 pokušaja i detaljno logovanje u Vercel Logs.
- APP_EMAIL_FROM više nije obavezan; podrazumevano je `FiscalBox <noreply@fiscalbox.rs>` jer je domen fiscalbox.rs verifikovan.
- `profiles.auth_email` se eksplicitno čuva prilikom registracije.
- Registracija se više ne briše ako email servis privremeno ne odgovori. Nalog ostaje neproveren i korisnik odmah dobija opciju `Pošalji ponovo`.
- Resend verifikacije radi i za starije naloge kojima `profiles.auth_email` nije bio popunjen.
- Na login ekranu email je automatski popunjen nakon registracije i jasno se prikazuje da li je slanje uspelo ili nije.
- Nema nove SQL migracije.

## Obavezna Vercel promenljiva
`RESEND_API_KEY=re_...`

`APP_EMAIL_FROM` je opciona; ako je nema koristi se `FiscalBox <noreply@fiscalbox.rs>`.
