# FiscalBox V5.9.2.0

## Izmene
- Pretplata u USER modu sada jasno nudi **Nadogradi na Basic / Premium** za besplatni/probni/neaktivni nalog.
- Uklonjen je opisni blok „Kako radi naplata“.
- Izbor paketa kreira PDF predračun, šalje ga na email firme i nakon kreiranja vodi korisnika u **Fajlovi → Računi / predračuni**.
- Fajlovi sada imaju posebne rubrike **Računi / predračuni** i **Garancije** pored Arhive.
- Garancije prikazuju fiskalne račune označene kao dokaz kupovine. Očigledna IT/tehnička roba se automatski predlaže/arhivira, a svaki račun može ručno da se doda ili ukloni iz Garancija.
- Buyer ID sa fiskalnog računa se robustno tumači kao PIB, uključujući formate `ID kupca: 10:114814160`, `BuyerId=10:114814160` i sabijeni `10114814160`.
- Po PIB-u kupca FiscalBox prvo proverava postojeću FiscalBox organizaciju, a zatim NBS/company registry servis i čuva naziv, MB i adresu kupca uz račun.
- Otvaranje starog fiskalnog računa pokušava da dopuni PIB i podatke kupca i vraća ih u bazu.

## Obavezno
Pre deploy-a pokrenuti `SQL_026_KUPAC_GARANCIJE_FAJLOVI.sql`.

## Napomena
Rubrika Računi / predračuni koristi postojeću tabelu `billing_invoices` kao jedinstveni izvor istine; PDF se generiše iz tog zapisa i ne pravi se duplirana datoteka u Storage-u. Garancije su logička arhiva fiskalnih računa i ne dupliraju originalni receipt zapis.
