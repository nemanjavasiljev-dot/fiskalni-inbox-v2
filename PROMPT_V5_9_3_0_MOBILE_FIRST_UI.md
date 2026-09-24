# PROMPT — FiscalBox V5.9.3.0 Mobile-first UI

Cilj: redizajnirati korisnički i knjigovodstveni mobilni interfejs prema odobrenom mockupu, bez menjanja poslovne logike aplikacije.

## 1. USER / FIRMA — mobilni header
- Mobilni header organizovati u dva reda.
- Prvi red: levo FiscalBox logo i wordmark; desno dve stalne ikone: Inbox/Poruke i Notifikacije.
- Obe ikone moraju imati badge sa brojem nepročitanih stavki i osvežavanje na svakih 5 sekundi preko postojećeg `/api/communication/counts` endpointa.
- Klik na kovertu otvara `/app/messages`.
- Klik na zvono otvara `/app/notifications`.
- Drugi red: puna kartica aktivne firme sa avatarom/logom, nazivom firme, PIB-om i chevron strelicom.
- Klik na karticu otvara postojeći meni kompanije: podešavanja kompanije, podešavanja korisnika i odjava.
- Dugačak naziv firme mora koristiti ellipsis i nikad ne sme kvariti raspored.
- Header mora biti sticky na mobilnom i bez velikih praznih površina.

## 2. KNJIGOVOĐA — mobilni header
- Primeniti isti vizuelni princip.
- Prvi red: FiscalBox KNJIGO levo, Poruke i Notifikacije desno.
- Drugi red: kartica naloga knjigovođe sa inicijalom, ulogom i korisničkim imenom; klik otvara mobilni sidebar/drawer.
- Desktop sidebar ostaje nepromenjen.

## 3. INBOX / PORUKE
- Zadržati kompletan Inbox sa tabovima Primljene, Poslate i Nepročitane.
- Omogućiti Nova poruka, Odgovori, Označi kao pročitano/nepročitano i Obriši.
- Mobilni ekran mora imati isti novi header.

## 4. NOTIFIKACIJE
- Zadržati odvojeni Notification Center.
- Omogućiti čitanje, reakcije Primljeno/Važno/Hvala/Završeno, brisanje i otvaranje povezane stavke.
- Mobilni ekran mora imati isti novi header.

## 5. VIŠE — GRID MENI
- Na mobilnom se `Više` otvara preko celog ekrana i ima sopstveni scroll.
- Na vrhu prikazati karticu aktivne firme: avatar/logo, naziv, PIB i paket.
- Sve glavne funkcije moraju prvo biti prikazane kao pregledan 2-kolonski grid blokova sa ikonama.
- Grid: Poruke, Notifikacije, Fajlovi, Moji računi, Knjigovođa, Automatsko slanje, Pošalji račune, Pretplata, CSV izvoz, Podešavanja i Odjava.
- Knjigovođa i Automatsko slanje vode na odgovarajuće sekcije podešavanja unutar istog full-screen menija.
- Ručno `Pošalji račune` ostaje zaključano dok je uključen nedeljni ili mesečni automatski režim.

## 6. RESPONSIVE
- Mobile-first breakpoint do 650 px za USER header.
- KNJIGO mobilni header/drawer do 900 px.
- Desktop ponašanje ne menjati osim zajedničkih komunikacionih komponenti.
- Koristiti postojeće FiscalBox boje, fontove, border-radius i komponente.
- Ne duplirati backend logiku; koristiti postojeće MessageCenter, NotificationCenter i CommunicationQuickActions.

## 7. SIGURNOST I KOMPATIBILNOST
- Ne menjati bazu podataka niti SQL migracije za ovaj UI update.
- Ne menjati API ugovore.
- Ne menjati autentikaciju, pretplate, slanje knjigovođi, APR, QR, billing ili PDV logiku.
- Redizajn mora ostati kompatibilan sa V5.9.2.9.
