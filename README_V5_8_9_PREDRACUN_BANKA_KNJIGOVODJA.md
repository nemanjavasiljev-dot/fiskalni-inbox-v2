# FiscalBox V5.8.9 — Predračun, banka i prijem knjigovođe

## Obavezno pre deploy-a

1. U Supabase SQL Editor pokrenuti ceo `SQL_017_PRETPLATE_PREDRACUN_BANKA_PREUZMI_SVE.sql`.
2. U MASTER > Računi / predračuni upisati stvarni dinarski tekući račun izdavaoca OSKAR ZOMBORI PR ALSET CO. Bez njega FiscalBox neće izdati predračun sa IPS QR kodom.
3. U Vercel-u moraju ostati `RESEND_API_KEY` i `APP_EMAIL_FROM=FiscalBox <noreply@fiscalbox.rs>`.
4. Redeploy V5.8.9.

## Automatska naplata pretplate

- Izbor Basic/Premium paketa automatski pravi PDF predračun.
- Predračun se šalje na email i pojavljuje u `Moji računi > Neplaćeno`.
- Izdavalac: OSKAR ZOMBORI PR ALSET CO., PIB 115266735, MB 68230403.
- Izdavalac nije u sistemu PDV-a: stopa PDV-a u FiscalBox dokumentima je 0 i PDF sadrži odgovarajuću napomenu.
- Predračun sadrži NBS IPS QR za uplatu. QR koristi stvarni bankovni račun iz MASTER podešavanja i jedinstven poziv na broj.
- Nakon verifikacije uplate predračun dobija status `converted`, izdaje se finalni račun sa statusom `paid`, finalni PDF se šalje emailom i pojavljuje u `Moji računi > Plaćeno`.
- Plaćena bank-transfer pretplata aktivira servis za naredni mesečni period.

## MASTER — Banka / uplate

Dodata je posebna sekcija `Banka / uplate`:

- pregled bankarskih transakcija,
- nerasknjižene / rasknjižene uplate,
- otvoreni predračuni,
- ručno uparivanje uplate i predračuna,
- automatsko izdavanje finalnog računa posle uparivanja,
- automatsko aktiviranje pretplate,
- generički server-side bank API adapter i webhook.

### Bank API environment variables

```env
BANK_PROVIDER=generic_json
BANK_API_URL=
BANK_API_TOKEN=
BANK_API_AUTH_HEADER=Authorization
BANK_API_AUTH_SCHEME=Bearer
BANK_API_ACCOUNT_ID=
BANK_WEBHOOK_SECRET=
```

**Važno:** banke nemaju isti API/auth format. V5.8.9 ne izmišlja endpoint banke. Kada se definiše konkretna banka ALSET CO. i dobiju produkcioni API kredencijali, adapter se prilagođava njenom tačnom API-ju. Do tada MASTER može da verifikuje predračun ručno preko `Plaćeno`, a webhook/generički JSON adapter je spreman za integraciju.

## Knjigovođa — prijem

U dashboard knjigovođe dodat je poseban `PRIJEM`:

- Fiskalni računi — broj primljenih i novih + `Preuzmi sve račune`.
- Dokumenti — broj primljenih i novih + `Preuzmi sve dokumente`.
- Preuzimanje pravi ZIP po klijentima za izabrani/tekući mesec.
- Fiskalni računi u ZIP-u su PDF arhivske kopije.
- Dokumenti se preuzimaju u originalnom formatu iz storage-a.
- Masovno preuzimanje ažurira status preuzetih stavki.

## Produkcioni test

1. MASTER > Računi / predračuni: upisati i sačuvati dinarski račun ALSET CO.
2. USER > Pretplata > izabrati Basic ili Premium.
3. Proveriti da je email sa PDF predračunom stigao.
4. USER > Moji računi > Neplaćeno: otvoriti PDF i skenirati IPS QR m-banking aplikacijom.
5. MASTER: nakon stvarne uplate potvrditi/rasknjižiti uplatu.
6. USER > Moji računi > Plaćeno: proveriti finalni račun i email.
7. KNJIGOVOĐA: proveriti `PRIJEM`, zatim posebno `Preuzmi sve račune` i `Preuzmi sve dokumente`.

## Pravna napomena

FiscalBox generiše komercijalni PDF predračun/račun sa podacima izdavaoca i primaoca, stavkom usluge, iznosom, poreskom napomenom i IPS podacima. Obaveze korišćenja Sistema elektronskih faktura (SEF) zavise od statusa izdavaoca/primaoca i konkretne transakcije. Ako za transakciju postoji obaveza izdavanja kroz SEF, FiscalBox PDF nije zamena za propisani SEF tok dok se SEF integracija posebno ne poveže.
