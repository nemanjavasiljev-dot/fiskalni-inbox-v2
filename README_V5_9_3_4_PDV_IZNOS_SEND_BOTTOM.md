# FiscalBox V5.9.3.4 — PDV iznos + Pošalji knjigovođi na dnu

## Urađeno

- Fiskalni verification JSON se i dalje preuzima direktno sa dozvoljenog domena Poreske uprave.
- PDV se sada pouzdanije izvlači iz fiskalnog računa:
  - prvo iz eksplicitnog total-tax polja kada postoji,
  - zatim iz `journal` teksta iz reda `Ukupan iznos poreza`,
  - kao rezerva iz specifikacije poreskih stopa.
- `total_tax` se upisuje kao konkretan iznos prilikom svakog novog skeniranja.
- QR kartica `Status računa` u redu `PDV` prikazuje konkretan iznos u RSD, uz informaciju da li je PDV podoban za korišćenje / potrebnu proveru.
- USER dashboard i tabela koriste isti izračunati PDV iznos.
- KNJIGOVOĐA pregled računa, PDV zbir i mesečni/godišnji obračun koriste isti iznos.
- Za stare račune sa praznim `total_tax`, USER i detalj klijenta mogu izračunati PDV iz sačuvanog `raw_json`; početni KNJIGOVOĐA dashboard dopunjava nedostajuće vrednosti za prikaz.
- USER dugme `Pošalji knjigovođi` je uklonjeno iz vrha dashboarda i postavljeno posle baze fiskalnih računa, na dno sadržaja do kog korisnik dolazi skrolovanjem.
- Automatski režim slanja i zaključavanje ručnog dugmeta ostaju nepromenjeni.

## Baza

Nema nove SQL migracije. Novi skenovi čuvaju PDV u postojećem `receipts.total_tax` polju.
