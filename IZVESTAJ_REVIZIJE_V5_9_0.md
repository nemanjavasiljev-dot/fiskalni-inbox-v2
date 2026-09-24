# Izveštaj revizije FiscalBox 5.8.8 → 5.9.0

## Zaključak i granice

Izmenjen je dostavljeni izvorni kod. Otklonjeni su dole navedeni konkretni propusti; ovo nije garancija da ne postoji nijedna preostala greška. Nije izvršena objava na hosting niti promena stvarne baze. Nisu poslati emailovi/SMS poruke niti pokrenute naplate.

Automatska PIB pretraga sada ima povezanu putanju ka javnoj NBS pretrazi bez API ključa. Njeno ponašanje provereno je sintetičkim odgovorima i lažiranim mrežnim pozivima u testovima; stvarni odgovor NBS-a sa hostinga nije potvrđen. Ovu razliku ne treba prećutati korisnicima niti označavati integraciju kao produkciono verifikovanu.

## Ispravke

| Oblast | Pronađen problem | Izmena |
|---|---|---|
| Administracija | Javna prijava je automatski kreirala master nalog sa poznatom lozinkom | Uklonjen bootstrap; eksplicitno postavljanje administratora u SQL-u; stari nepodešeni bootstrap nalog se demotira migracijom |
| Dozvole | Korisnik je mogao direktno menjati globalnu ulogu, pretplatu i privilegovana polja | Ukinuti direktni INSERT/UPDATE/DELETE za kritične tabele; server proverava dozvole |
| Firma | Javni ručni unos je mogao prepisati postojeći ručni zapis druge firme | Postojeći zajednički zapis se ne menja; neslaganje PIB/MB odbija se |
| PIB | Unos se skraćivao na 9 cifara, pa je pogrešan broj mogao postati drugi PIB | Stroga dužina, očuvanje pogrešnog unosa i provera kontrolne cifre |
| PIB izvor | Pretraga se prekidala bez NBS SOAP kredencijala | Povezan javni NBS adapter, keš i jasno označen rezervni rezultat |
| NBS HTML | Pretpostavljane pozicije kolona i skraćivanje MB | Kolone po zaglavljima, tačan PIB, očuvanje MB, deduplikacija računa; nepoznat format odbija se |
| NBS SOAP | Odgovor je mogao dobiti traženi PIB i kada ga servis nije vratio | Nedostajući ili različit PIB se odbija |
| Pretraga | Zastareli odgovori mogli su izabrati prethodno ukucanu firmu | Abort i invalidacija zahteva u obe komponente pretrage |
| Pretraga naziva | Različita transliteracija đ/ђ | Usklađena normalizacija i osvežavanje normalized_name u migraciji |
| APR | Pretpostavljalo se da je konfiguracija uvek dostupna | Status zavisi od konfiguracije; uklonjen neproveren podrazumevani feed URL; popravljen placeholder {{query}} |
| Registracija | Email se automatski smatrao potvrđenim | Potvrda preko Supabase Auth; jasna poruka korisniku; poziv knjigovođi posle prijave |
| Migracije | SQL 015 nedostajao je u migrations direktorijumu | Dodata postojeća idempotentna migracija |
| Povezivanje | Nepoznata/prazna odluka značila je prihvatanje | Obavezna eksplicitna odluka approve/reject |
| Povezivanje | Obični zaposleni upravljali su poslovnim vezama | Samo vlasnik/ovlašćeni administrator |
| Povezivanje | Izmenjivi kontakt/telefon tretiran je kao dokaz identiteta | Prihvatanje preko ciljne organizacije ili potvrđenog emaila; neregistrovani SMS primalac koristi email |
| Povezivanje | Više delimičnih upisa i paralelne odluke | Nova putanja prihvatanja koristi transakciju i zaključavanje reda |
| Knjigovođa | Agencija je mogla dodeliti proizvoljan ID tuđe firme zaposlenom | Provera aktivne odobrene veze i postojećih uloga |
| Knjigovođa | Blokirana veza mogla je ostaviti zaposlenima pristup | RLS traži aktivnu vezu, aktivnu uslugu i odgovarajuće članstvo/dodelu |
| Uloge | Upsert povezivanja mogao je prepisati ulogu vlasnika | Postojeća uloga se čuva |
| Dashboard | Uzimano je poslednjih 300 globalnih zahteva, pa su legitimni zahtevi ispadali | Ciljani upiti po organizaciji i potvrđenom emailu |
| Organizacija | Moguće paralelno kreiranje dve organizacije za istu firmu | Serijalizacija novih upisa po company_id; postojeći duplikati nisu automatski brisani |
| Organizacija | Neuspeh member/sub upisa ostavljao je delimičnu organizaciju | Cleanup pri neuspehu setup rute |
| OAuth | Parametar next dozvoljavao je preusmeravanje van aplikacije | Samo interna putanja i provera greške razmene koda |
| API | Cross-origin zahtevi mogli su stići do cookie-auth mutacija | Provera Origin/Sec-Fetch-Site u middleware-u |
| Dokumenti | Negativna veličina, nepostojeći objekat i proizvoljna metapolja | Pozitivna celobrojna veličina; provera stvarnog objekta; veličina/MIME iz storage metapodataka |
| Dokumenti | Greška pri ponovljenoj registraciji mogla je obrisati već važeći fajl | Idempotentan odgovor za postojeći dokument; nema brisanja objekta na konflikt |
| Dokumenti/računi | Zastarele dozvole nisu dosledno poštovale pristup usluzi | Usklađeni helperi i upisne dozvole; ne može se promeniti tenant/storage putanja dokumenta običnim update-om |
| QR | Pratio se redirect ka proizvoljnom odredištu | Redirect odbijen; ograničeni protokol, port i URL kredencijali |
| Računi | Tekst „nevalidan”/„validation pending” mogao se pogrešno prepoznati | Konzervativno prepoznavanje validnosti, negativni statusi i nepoznat status |
| Iznosi | Lokalizovan format 1.234,56 nije radio; prazno je postajalo 0 | Podržani srpski/engleski decimalni formati, prazno ostaje null |
| Računi | Paralelni sken istog QR-a vraćao je grešku | Duplikat vraća postojeći račun |
| CSV | Ćelije su mogle pokrenuti formulu u Excelu | Neutralisani opasni početni znakovi tekstualnih ćelija |
| Naplata | Webhook beležen pre finansijskih upisa, greške ignorisane | SQL transakcija za događaj, pretplatu, organizaciju i račun; neuspeh vraća 503 za retry |
| Naplata | Obaveštenje o uplati moglo ukinuti administratorsku blokadu | service_blocked_at se poštuje; proveravaju se prodavnica i paket kod subscription događaja |
| Naplata | Stariji subscription događaj mogao pregaziti noviji | Čuva se i proverava provider_updated_at |
| PWA | Keširanje login/register navigacije i potencijalno RSC odgovora | Keš samo za statičke resurse; provera cache-control i redirect odgovora |
| Email | Promena Auth emaila nije ažurirala profil | Trigger za sinhronizaciju auth_email |

## Šta je provereno

- 20 regresionih testova prolazi (`npm test`), uključujući sintetičke NBS odgovore i simulirane greške.
- 141 TypeScript/TSX fajl prolazi provere parsiranja/transpilacije, TypeScript 5.9.3, bez sintaksnih grešaka.
- Rezultati su u `TEST_REZULTATI.txt`. Linija `billing-transaction test_failure` je očekivani zapis namerno simulirane greške u testu.
- Provera ZIP integriteta izvršena pri pakovanju.

## Šta nije potvrđeno

- `npm install` blokiran je sa HTTP 403 pri preuzimanju @supabase/ssr. Nisu izvršeni puni typecheck, Next.js build, browser/E2E testovi ni audit svih zavisnosti.
- Supabase kredencijali nisu dostavljeni. Migracije, RLS i transakcije nisu izvršene nad stvarnom bazom. Prolaz testova ne zamenjuje ovu proveru.
- NBS javna stranica je pronađena u javnoj pretrazi, ali stvarni upit sa PIB-om nije bio dostupan za izvršavanje u okruženju revizije. HTML fixture je izričito sintetički. Moguće su razlike stvarnog HTML-a, zaštita od automatizacije ili mrežna ograničenja hostinga.
- Nije potvrđen besplatan zvaničan APR API za pretragu svih firmi po PIB-u. Ne garantuje se obuhvat svih pravnih lica/preduzetnika preko registra bankovnih računa.
- Slanje emaila/SMS-a, potvrda naloga, plaćanje i printer/kamera/PWA moraju se proveriti na stvarnom deploymentu.
- QR verifier i dalje zavisi od formata odgovora Poreske uprave. Ako se vrati HTML umesto očekivanog JSON-a, račun ostaje sa neuspelom proverom; nisu izmišljeni iznosi niti lažna verifikacija.
- Ova revizija ne uvodi bankarski API, IPS QR fakturisanje ni kompletan novi tok predračun → konačni račun. Postojeća komercijalna integracija je Lemon Squeezy, uz postojeću ručnu arhivu računa. Ne treba je predstavljati kao već povezanu sa bankom.
- Pravna usklađenost dokumenata i PDV tretman nisu predmet potvrđenog pravnog/računovodstvenog pregleda.
- Potvrđen email nije dokaz zakonskog ovlašćenja za predstavljanje firme. Za strogo poslovno verifikovanje novog vlasnika potreban je poseban proces provere; pretraga javnog PIB-a to ne rešava.
- Starije ručne relation/invite putanje nisu sve prebačene u jednu SQL transakciju. Nova standardna putanja `connections` jeste. Ne predstavlja se cela aplikacija kao formalno bezbednosno sertifikovana.

## Izvori za registar

- NBS javna pretraga rezidenata: https://webappcenter.nbs.rs/PnWebApp/CompanyAccount/CompanyAccountResident
- NBS stranica Jedinstvenog registra računa: https://www.nbs.rs/sr/drugi-nivo-navigacije/servisi/jedinstveni-registar-racuna/
- APR uslovi pristupa pretrazi: https://www.apr.gov.rs/registri/preduzetnici/pretraga-podataka.2050.html

APR navodi pristup preko internet pretraživača ili veb-servisa, uz ograničenja drugih načina preuzimanja. Zbog toga ovde nije dodat scraper APR portala niti zaobilaženje zaštite.
