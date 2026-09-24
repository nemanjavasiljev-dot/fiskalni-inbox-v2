# FiscalBox V5.9.1.6 — Push, dokument knjigovođa→klijent i dodela klijenta

## 1. Windows / mobilni PUSH

- Push pretplata se sada server-side vezuje za trenutno prijavljenog korisnika. Ako je isti browser/PWA ranije koristio drugi nalog, endpoint se bezbedno prebacuje na novi nalog.
- Ako je promenjen VAPID javni ključ, stara browser pretplata se automatski odjavljuje i pravi se nova.
- Dugme za uključivanje obaveštenja je vidljivo i na telefonu (na malom ekranu ostaje ikonica zvona).
- Nakon ručnog uključivanja aplikacija automatski šalje test push poruku.
- Web Push ostaje primarni mehanizam za background obaveštenja.
- Dodat je 5-sekundni fallback polling preko `user_notifications`: dok je FiscalBox otvoren, nova stavka će biti prikazana kao FiscalBox popup i native browser/PWA notifikacija i ako push transport zakasni.
- Na iPhone/iPad Web Push zahteva da FiscalBox bude dodat na Home Screen i da korisnik odobri notifikacije.

Obavezne Vercel promenljive:

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:noreply@fiscalbox.rs
```

## 2. Knjigovođa šalje dokument klijentu

U klijentu je dodat tab **Pošalji dokument**.

Tok:

1. knjigovođa izabere dokument do 20 MB;
2. po želji uključi `Dodaj poruku u PUSH obaveštenje`;
3. klikne `Pošalji dokument klijentu`;
4. dokument se čuva u storage-u i `documents` tabeli;
5. smer dokumenta je `accountant_to_client`;
6. `archived_at` se postavlja odmah — dokument je automatski u arhivi;
7. klijent dobija FiscalBox notifikaciju i push;
8. dokument je vidljiv u USER > Fajlovi i u novom tabu **Arhiva**.

## 3. Prihvatanje novog klijenta kod ADMIN knjigovođe

Kada ADMIN knjigovođa klikne `Prihvati`, više se ne povezuje odmah.
Otvara se prozor **Dodeli klijenta zaposlenom**.

Opcije:
- `ADMIN knjigovođa / ostavi kod mene`
- svaki zaposleni knjigovodstvene agencije

Klikom na **Dodeli i prihvati klijenta**:
- aktivira se veza knjigovođa–klijent;
- ako je izabran zaposleni, kreira se njegov `accountant` pristup klijentu;
- upisuje se `accountant_client_assignments`.

## 4. SQL

Pre deployment testa pokrenuti:

```text
SQL_024_PUSH_DOKUMENTI_DODELA.sql
```

Migracija:
- dopunjava `documents` kolonama za smer, poruku, arhivu i slanje klijentu;
- kreira `user_notifications` tabelu za pouzdani polling fallback;
- ne briše postojeće podatke.

## 5. Test PUSH-a

Posle Vercel deploymenta:

1. ulogujte se;
2. kliknite `Uključi obaveštenja`;
3. browser/Windows/Android mora imati dozvolu za notifikacije;
4. FiscalBox automatski šalje test poruku;
5. ako test ne stigne, dugme prikazuje konkretnu grešku (VAPID, subscription ili browser permission).

Napomena: trajanje i fizičku veličinu native Windows/Android/iOS notifikacije određuje operativni sistem. FiscalBox popup unutar aplikacije i dalje se zatvara posle 5 sekundi.
