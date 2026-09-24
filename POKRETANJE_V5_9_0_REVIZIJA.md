# Pokretanje FiscalBox 5.9.0

## Pre nadogradnje

Napravite backup baze i postojećeg deploymenta. Prvo instalirajte na testno okruženje sa kopijom baze. Ovo nije ZIP koji se samo raspakuje u PHP hosting: aplikacija koristi Next.js/Node.js i Supabase.

## 1. Baza

- Nova instalacija: izvršite `supabase/migrations/001_...sql` do `020_...sql`, numeričkim redom.
- Nadogradnja sa 5.8.8: proverite da su 001–016 već izvršene. Migracija 015 je ranije bila samo u korenu kao `SQL_015_VERIFIKACIJA_KNJIGOVODJE.sql`; sada je uključena u migrations folder i bezbedno se ponavlja.
- Zatim izvršite 017, 018, 019 i 020 redom. Ne pokrećite stare migracije naslepo ponovo na živoj bazi: neke istorijske migracije menjaju statuse pretplata.
- 017 menja dozvole, uvodi transakcijsko prihvatanje povezivanja i deaktivira samo poznati stari automatski master nalog koji još zahteva promenu lozinke.
- 018 uvodi transakcijsku obradu obaveštenja o naplati.
- 019 sprečava istovremeno kreiranje dve nove organizacije za istu firmu i sinhronizuje promenjen email iz Auth u profil.
- 020 zatvara pristup knjigovođama kada je veza blokirana ili nije odobrena.

SQL migracije nisu izvršene nad stvarnim Supabase projektom tokom ove revizije. Obavezno ih proverite u testnom projektu pre produkcije.

## 2. Podešavanja

Kopirajte `.env.example` u `.env.local` za lokalni rad ili postavite iste promenljive u hosting panelu.

Obavezno:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` — isključivo server; nikada NEXT_PUBLIC.
- `NEXT_PUBLIC_APP_URL` — tačan HTTPS domen aplikacije, bez putanje.

Za registraciju u Supabase Auth uključite **Confirm email**, podesite SMTP, Site URL i dozvoljeni redirect `https://vas-domen/auth/callback`. Bez potvrde emaila ova verzija namerno ne završava javnu registraciju. Proverite i slanje reset linka za lozinku.

Za transakcione pozive podesite `RESEND_API_KEY` i `APP_EMAIL_FROM`. Za SMS su potrebni Twilio podaci. Ne računajte SMS/email servise kao besplatne samo zato što je osnovna PIB pretraga bez API ključa.

## 3. PIB

`NBS_PUBLIC_LOOKUP_ENABLED=true` uključuje javni adapter bez NBS naloga. SOAP promenljive mogu ostati prazne. Ako ih popunite, koristi se SOAP servis.

Besplatan javni izvor je:
https://webappcenter.nbs.rs/PnWebApp/CompanyAccount/CompanyAccountResident

Nije potvrđen live odgovor ovog adaptera tokom revizije. Ne koristi se CAPTCHA zaobilaženje niti neprovereni podaci kao zvanična verifikacija. Ako NBS promeni stranicu ili odbije automatizovan zahtev, korisnik dobija upozorenje i može otvoriti registar ili ručno uneti podatke.

Za naziv/MB potreban je prethodno popunjen lokalni registar. `APR_OPEN_DATA_URL` unosite samo kada imate potvrđen i dozvoljen JSON izvor. Stari hardkodovani URL nije ostavljen kao navodno sigurno funkcionalan servis. GitHub APR sync sada čita taj URL iz secrets.

## 4. Administrator

Kreirajte svoj nalog u Supabase Auth, potvrdite email, pa izmenite email u `supabase/MASTER_ADMIN.sql` i izvršite taj fajl u SQL Editoru. Koristite jaku, jedinstvenu lozinku.

Automatsko otvaranje naloga MASTER/MASTER je uklonjeno. Ako je stara verzija bila javno dostupna, pregledajte postojeće administratorske naloge i sesije. Revizija koda ne može utvrditi da li je stari propust ranije iskorišćen.

## 5. Instalacija i provere

Koristite podržan Node.js 22 LTS ili noviji kompatibilan runtime.

```sh
npm install
npm test
npm run check:syntax
npm run typecheck
npm run build
npm start
```

Posle uspešnog instaliranja sačuvajte generisani `package-lock.json`; dalje koristite `npm ci`. Zavisnosti i build nisu preuzeti/provereni u okruženju revizije zbog HTTP 403 sa npm registra. Nema izmišljenog lock fajla.

Živa provera PIB-a na sopstvenom deploymentu:

```sh
FISCALBOX_TEST_URL=https://vas-domen FISCALBOX_TEST_PIB=VAS_PIB npm run test:registry-live
```

Koristite poznati, stvarni PIB. Za potvrdu spoljnog servisa testirajte PIB koji još nije u lokalnom kešu i proverite vraćeni naziv/MB/adresu. Test keša sam po sebi nije dokaz rada NBS-a.

## 6. Obavezna provera pre objave

1. Registracija: stiže potvrdni email, potvrda radi, prijava i reset lozinke rade.
2. PIB: poznata firma, pogrešna kontrolna cifra, nepoznat PIB, prekid NBS veze, ručni unos.
3. Dva odvojena naloga firmi: nema pristupa tuđim računima i dokumentima.
4. Knjigovođa: zahtev se prihvata/odbija, običan zaposleni ne upravlja povezivanjem, blokirana veza gubi pristup.
5. Dokument: upload, ponovljeni register zahtev, slanje knjigovođi i preuzimanje.
6. Naplata: realna konfiguracija provajdera, testna kopija baze, ponovljeni webhook bez duplog knjiženja, greška transakcije vraća 503; blokadu superadmina webhook ne ukida.
7. Mobilni browser/PWA: instalacija, kamera, QR, navigacija i povratak posle osvežavanja.

U produkciju prebacite tek posle ovih provera. Aktivacija na stvarnom serveru nije deo već izvršenih testova ovog paketa.
