# FiscalBox V5.8.6 — verifikacija knjigovođe i automatski prijem klijenta

## Šta je promenjeno

Firma više ne bira niti popunjava podatke knjigovođe. Za zahtev su potrebna samo:

- PIB knjigovodstvene firme (9 cifara)
- email knjigovođe

FiscalBox šalje verifikacioni email sa jednokratnim linkom koji važi 7 dana.

Klikom na **Verifikuj i prihvati klijenta** sistem proverava:

1. da poziv postoji i nije istekao,
2. da knjigovodstvena firma sa unetim PIB-om ima FiscalBox nalog,
3. da email iz poziva pripada vlasniku/zaposlenom ili kontakt emailu te knjigovodstvene firme.

Tek nakon toga se veza aktivira i firma se automatski pojavljuje kao klijent u dashboardu knjigovođe.

Ako knjigovođa još nema FiscalBox nalog, verifikacioni link nudi registraciju. Registracijom sa istim PIB-om i emailom postojeći poziv se automatski prihvata.

## Obavezno pre deploy-a

U Supabase SQL Editoru pokrenuti:

`SQL_015_VERIFIKACIJA_KNJIGOVODJE.sql`

## Email konfiguracija u Vercel-u

Moraju postojati:

- `RESEND_API_KEY`
- `APP_EMAIL_FROM`

Primer `APP_EMAIL_FROM`:

`FiscalBox <noreply@vas-domen.rs>`

Domen pošiljaoca mora biti verifikovan u Resend-u.

Ako email nije stvarno poslat, FiscalBox ne prikazuje lažnu potvrdu — zahtev vraća grešku i poziv se poništava.

## Tok

Firma → Više → Pošalji zahtev knjigovođi → PIB + email → email knjigovođi → verifikacioni link → automatsko dodavanje klijenta → dashboard knjigovođe.
