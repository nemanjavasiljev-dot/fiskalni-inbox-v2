# FiscalBox V5.7 — verifikovani račun + multi-engine QR

## Štampa fiskalnog računa
- štampa prikazuje status verifikacije iz sistema Poreske uprave / eFiskalizacije;
- izdavalac: naziv, PIB, prodajno mesto, adresa i mesto kada su dostupni u verifikacionom odgovoru;
- kupac: naziv firme, PIB, MB i adresa iz centralnog registra kada PIB kupca postoji na fiskalnom računu;
- prikazuje NBS/APR izvor provere firme kupca kada je ta provera stvarno izvršena;
- SDC broj, vreme, brojač, RequestedBy, SignedBy, POS/MRC, referenca, način plaćanja, PDV i ukupno;
- stavke i poreska specifikacija kada ih verifikacioni odgovor sadrži;
- originalni journal kada ga verifikacioni odgovor sadrži;
- ponovo generisan QR kod vodi na originalni zvanični verifikacioni URL.

Važno: NBS proverava podatke o pravnom subjektu/računima, ne fiskalni račun. Fiskalni račun verifikuje Poreska uprava. Zato se te dve provere u štampi prikazuju odvojeno.

## QR skener
Tri nezavisna čitača rade kao fallback lanac:
1. browser/OS BarcodeDetector;
2. jsQR sa više prolaza i obradom kontrasta/threshold-a;
3. ZXing BrowserMultiFormatReader.

Za fotografije se rade dodatne rezolucije i centralni crop prolazi kako bi se čitali bledi i sitni QR kodovi sa termalnih računa.

## Nove npm zavisnosti
- `@zxing/browser`
- `qrcode`
- `@types/qrcode` (dev)

Nema nove SQL migracije.
