# FiscalBox V5.9.1.4 — kupac iz ID kupca + status štampe

## 1. Kupac na fiskalnom računu
FiscalBox sada prepoznaje PIB kupca i kada Poreska uprava podatak vrati samo u journal zapisu, npr:

`ID kupca: 10:114814160`

Prefiks `10:` se tretira kao tip identifikatora, a narednih 9 cifara kao PIB. Sistem zatim:

1. traži registrovanu FiscalBox organizaciju sa tim PIB-om;
2. ako je pronađe, popunjava naziv, MB i adresu kupca;
3. ako organizacija nije registrovana, pokušava lokalni registar kompanija;
4. stari receipt zapis automatski dopunjuje poljem `buyer_pib` kada se otvori prikaz za štampu.

Ovo radi i za ranije sačuvane račune čiji je `buyer_pib` bio prazan, ako journal sadrži ID kupca.

## 2. Status dugmeta Štampaj
U radnom prostoru knjigovođe, unutar klijenta:

- račun koji još nije štampan: dugme **Štampaj** je žuto;
- račun za koji je evidentirana radnja štampe: dugme **Štampaj** je zeleno.

Timestamp ostaje u `accountant_receipt_status.printed_at`.

## SQL
Nema nove SQL migracije za V5.9.1.4.
