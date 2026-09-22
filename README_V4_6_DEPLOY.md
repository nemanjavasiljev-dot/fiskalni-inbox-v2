# FiscalBox V4.6 — MASTER ADMIN deploy

## 1. Supabase SQL prvo
U Supabase -> SQL Editor pokrenite:

`supabase/migrations/008_v4_6_master_admin.sql`

Očekivani rezultat: `Success. No rows returned`.

Migracija dodaje:
- blokiranje/aktivaciju usluge na nivou RLS baze,
- ADMIN / USER privilegije zaposlenih u knjigovodstvenoj agenciji,
- browser push subscriptions,
- evidenciju email/push slanja,
- mesečne obračune knjigovođa,
- finansijske nagrade/bonuse,
- master audit log.

## 2. Kopiranje patch-a
Raspakujte `FiscalBoxV4_6_Patch.zip` i kopirajte SADRŽAJ preko lokalnog `fiskalni-inbox-v2` projekta.
Ne kopirajte spoljašnji patch folder kao podfolder repozitorijuma.

GitHub Desktop:
- Summary: `Add V4.6 master admin control center`
- Commit to main
- Push origin

Vercel će automatski pokrenuti deploy.

## 3. Email
Za pojedinačni/grupni email i automatsko slanje računa/predračuna potrebni su postojeći Vercel env ključevi:
- `RESEND_API_KEY`
- `APP_EMAIL_FROM`

Ako nisu podešeni, dokument/poruka se evidentira, ali email se neće automatski poslati.

## 4. Pravi browser PUSH
V4.6 koristi standardni Web Push + VAPID.

Generišite VAPID par lokalno (Node je dovoljan):

```bash
npx web-push generate-vapid-keys
```

U Vercel -> Environment Variables dodajte:
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = Public Key
- `VAPID_PRIVATE_KEY` = Private Key (Secret)
- `VAPID_SUBJECT` = npr. `mailto:admin@vasdomen.rs`

Posle dodavanja ključeva uradite novi Vercel redeploy.

Korisnik mora jednom kliknuti `Uključi push` u FiscalBox-u i dozvoliti browser notifikacije. Master može poslati push samo uređajima koji su se pretplatili.

## 5. MASTER funkcije
MASTER dashboard sada sadrži:
- firme / knjigovodstvene agencije,
- ukupan broj fiskalnih računa,
- račune koji čekaju slanje knjigovođi,
- mesečni promet od plaćenih pretplata,
- ukupno isplaćene provizije knjigovođama,
- godišnju kumulativnu dobit,
- 12-mesečni grafikon prihoda i isplata,
- aktivaciju/blokiranje usluge,
- ADMIN/USER privilegije u knjigovodstvu,
- ručni račun/predračun + email,
- pojedinačni/grupni email,
- pojedinačni/grupni browser push,
- generisanje mesečnog obračuna 250 RSD po aktivnom app korisniku,
- označavanje isplate knjigovođe,
- finansijske nagrade/bonuse.

## 6. Važno za račune
Dok je `billing_issuer_settings.is_demo = true`, PDF račun/predračun je DEMO/interni dokument. Za komercijalni poreski račun potrebno je postaviti stvarnog izdavaoca i po potrebi povezati odgovarajući SEF/fiskalni tok.

## 7. Test redosled
1. Master -> Pregled.
2. Klijenti i usluge -> blokirajte TEST firmu i proverite da test nalog gubi pristup podacima.
3. Ponovo aktivirajte.
4. Knjigovođe -> promenite test zaposlenog USER/ADMIN.
5. Računi/predračuni -> kreirajte test predračun.
6. Komunikacija -> test email.
7. Nakon VAPID podešavanja: korisnik `Uključi push`, zatim test push iz MASTER-a.
8. Obračuni -> Generiši tekući mesec -> označite test isplatu plaćenom.
9. Dodajte test nagradu knjigovođi.
