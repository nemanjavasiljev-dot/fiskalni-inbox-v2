# FiscalBox V5.9.1.3 — Windows push + email verifikacija

## 1. Windows/PWA obaveštenja
FiscalBox sada koristi standardni Web Push + Service Worker. Kada korisnik jednom dozvoli obaveštenja, aplikacija pri svakom narednom otvaranju automatski obnavlja push pretplatu. Push može stići i kada FiscalBox prozor nije otvoren, pod uslovom da Chromium/Edge/Chrome i Windows imaju dozvoljena obaveštenja.

Dok je aplikacija otvorena, isti događaj se prikazuje i kao FiscalBox prozorčić dole desno približno 4 x 4 cm i automatski nestaje posle 5 sekundi.

Windows sistemski toast kontroliše sam Windows: aplikacija ne može pouzdano nametnuti tačnu fizičku dimenziju niti tačno 5 sekundi za nativni toast.

### Vercel VAPID promenljive
Ako ih još nema, generišite ključeve lokalno u projektu:

```bash
npm install
npm run vapid:generate
```

U Vercel -> Settings -> Environment Variables dodajte:

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<publicKey>
VAPID_PRIVATE_KEY=<privateKey>
VAPID_SUBJECT=mailto:noreply@fiscalbox.rs
```

Zatim Redeploy. Korisnik jednom klikne **Uključi Windows obaveštenja** i dozvoli notifikacije. Nakon toga FiscalBox ih sam održava aktivnim.

Automatski push je dodat za:
- novi zahtev USER ↔ knjigovođa,
- prihvaćen/odbijen zahtev,
- nove fiskalne račune poslate knjigovođi,
- nove dokumente poslate knjigovođi,
- potvrđenu uplatu i izdavanje finalnog računa,
- postojeće MASTER push poruke.

## 2. Verifikacija emaila pri registraciji
Registracija više ne zavisi od Supabase podrazumevanog SMTP-a. FiscalBox generiše Supabase verifikacioni link server-side i šalje ga preko verifikovanog Resend domena.

Potrebno je da Vercel već ima:

```text
RESEND_API_KEY=re_...
APP_EMAIL_FROM=FiscalBox <noreply@fiscalbox.rs>
NEXT_PUBLIC_APP_URL=https://vas-produkcioni-domen
```

Na login stranici, posle registracije, postoji i **Pošalji ponovo** za verifikacioni email.

U Supabase Authentication URL Configuration proverite da produkcioni FiscalBox domen postoji kao Site URL / dozvoljeni Redirect URL za `/auth/callback`.

## SQL
Za V5.9.1.3 nema novog SQL-a. Koristi postojeću `push_subscriptions` tabelu iz ranijih migracija.
