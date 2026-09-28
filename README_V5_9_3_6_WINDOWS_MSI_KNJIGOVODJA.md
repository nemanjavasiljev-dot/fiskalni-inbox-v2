# FiscalBox V5.9.3.6 — Windows MSI za knjigovođu

## Promena

Stari `.CMD` Windows setup za knjigovođu je uklonjen iz javnog download dela. Windows distribucija za KNJIGOVOĐU prelazi na pravi MSI paket.

## UX instalacije

- standardni MSI installer,
- Program Files instalacija,
- FiscalBox KNJIGO u Start meniju,
- Desktop shortcut,
- FiscalBox ikonica,
- regularni Windows uninstall kroz Apps & features.

## Prvo pokretanje

Dodata je ruta `/desktop/knjigovodja`:

- 1.35 s FiscalBox splash sa logom,
- onboarding od 4 kratka ekrana:
  1. klijenti,
  2. prijem računa i dokumenata,
  3. PDV/validnost/AI predlog,
  4. notifikacije, arhiva, štampa i preuzimanje,
- dugme „Pokreni FiscalBox“,
- onboarding se pamti lokalno i ne ponavlja pri svakom startu.

## Podešavanja knjigovođe

`Podešavanja > Desktop app` sada Windows korisnika usmerava na:

`/downloads/FiscalBox-Knjigovodja-Setup.msi`

PWA ostaje samo kao alternativa za Mac/telefon.

## Bitno za programera

Source paket sadrži WiX projekat u `desktop/windows-msi/`. Fizički `.msi` mora da se generiše na Windows build računaru pre produkcionog deploy-a i kopira u `public/downloads/`.

Pre javne distribucije MSI mora biti digitalno potpisan code-signing sertifikatom.
