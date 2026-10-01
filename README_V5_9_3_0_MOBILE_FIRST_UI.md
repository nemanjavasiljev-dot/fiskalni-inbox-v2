# FiscalBox V5.9.3.0 — Mobile-first UI

Ova verzija implementira odobreni mobile-first dizajn bez promene poslovne logike i bez nove SQL migracije.

## USER / FIRMA
- Mobilni header je sada u dva reda.
- Prvi red: FiscalBox levo, Inbox/Poruke i Notifikacije desno.
- Badge brojači koriste postojeći `/api/communication/counts` polling na 5 sekundi.
- Drugi red: aktivna firma sa avatarom/logom, nazivom, PIB-om i chevronom.
- Klik na karticu firme otvara postojeći meni kompanije.
- Novi header se koristi i na Porukama, Notifikacijama, Fajlovima, Pretplati i Podešavanjima.

## KNJIGOVOĐA
- Mobilni header prati isti obrazac.
- Prvi red: FiscalBox KNJIGO + Poruke + Notifikacije.
- Drugi red: kartica knjigovođe; klik otvara mobilni drawer meni.
- Desktop sidebar nije menjan.

## VIŠE
- Full-screen mobile overlay ostaje pouzdan preko React portala.
- Na vrhu se vidi firma, PIB i paket.
- Sve glavne funkcije su odmah prikazane u gridu.
- Knjigovođa i Automatsko slanje vode na odgovarajuća podešavanja u istom meniju.
- Fajlovi ekran takođe koristi portal za `Više`, da meni ne zavisi od scroll pozicije.

## Kompatibilnost
- Osnova: V5.9.2.9.
- Nema novog SQL-a.
- SQL 027 i 028 ostaju obavezni ako prethodno nisu pokrenuti.
- Poslovna logika za QR, APR, billing, poruke, notifikacije, pretplate, PDV i knjigovođu nije menjana.

## Provera
- `node scripts/check-syntax.cjs`: 174 TS/TSX fajla, 0 sintaksnih grešaka.
- Puni `next build` nije moguće lokalno pokrenuti bez `node_modules`; Vercel je finalna build provera.
