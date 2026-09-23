# FiscalBox V5.2 — jednostavnija registracija + APR Open Data

## Promene registracije
- U osnovnoj registraciji se više ne traže ime i prezime.
- Korisnik ne unosi korisničko ime. Sistem ga automatski generiše iz naziva izabrane firme i dodaje broj ako je zauzeto.
- Tok: tip naloga → PIB/naziv firme → email/lozinka → paket/trial → opciono knjigovođa.
- Login prihvata korisničko ime **ili email**.

## APR
- Podrazumevani izvor je zvanični APR Open Data endpoint:
  `https://openapi.apr.gov.rs/api/opendata/companies`
- Endpoint je snapshot registra, zato ga backend preuzima i filtrira; frontend ga nikad ne zove direktno.
- Rezultati se upisuju u centralnu `companies` tabelu i sledeće pretrage idu iz Supabase baze.
- Ako kasnije unesete ugovoreni APR web-service (`APR_API_*`), on ima prioritet nad Open Data snapshot-om.
- Open Data skup je prvenstveno pouzdan za naziv i matični broj. Ako PIB nije prisutan u javnom skupu, pretraga po PIB-u će raditi samo za firmu koja već ima PIB u centralnoj bazi ili kroz ugovoreni APR servis.

## Environment variables
Open Data radi i bez tajnog ključa. Opciono u Vercel-u:
```
APR_OPEN_DATA_URL=https://openapi.apr.gov.rs/api/opendata/companies
APR_OPEN_DATA_TIMEOUT_MS=60000
APR_OPEN_DATA_CACHE_MS=21600000
```

## Baza
Nema nove SQL migracije za V5.2. Potrebno je da su prethodno uspešno primenjeni SQL 009 i **ispravljeni SQL 010**.
