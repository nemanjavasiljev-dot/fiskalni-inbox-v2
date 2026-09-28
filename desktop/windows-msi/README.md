# FiscalBox KNJIGO — Windows MSI

Ovaj folder je izvor za standardnu Windows MSI instalaciju namenjenu isključivo knjigovođama.

## Šta MSI radi

- standardni Windows installer (Next / Install / Finish),
- instalira u `Program Files\\FiscalBox KNJIGO`,
- dodaje FiscalBox KNJIGO u Start meni,
- dodaje Desktop prečicu,
- koristi `FiscalBox.ico`,
- pojavljuje se u Windows Apps & features i uklanja se regularnim Uninstall postupkom,
- pokreće `https://fiscalbox.rs/desktop/knjigovodja?source=msi` u zasebnom Edge/Chrome app prozoru,
- ne čuva poslovne podatke lokalno; web aplikacija i autentikacija ostaju postojeći FiscalBox sistem.

## Prvo pokretanje

Web ruta `/desktop/knjigovodja` prikazuje:

1. FiscalBox splash ekran sa logom,
2. kratku prezentaciju funkcija za knjigovođu,
3. zatim otvara `/app` (ili login ako korisnik nije prijavljen).

Prezentacija se prikazuje samo prvi put na tom Windows/browser profilu. Sledeća pokretanja prikazuju samo kratki splash i otvaraju dashboard.

## Build MSI-ja

MSI se mora graditi na Windows build računaru sa instaliranim WiX Toolset 4+.

U PowerShell-u iz ovog foldera:

```powershell
.\\build-msi.ps1
```

Rezultat:

```text
desktop\\windows-msi\\dist\\FiscalBox-Knjigovodja-Setup.msi
public\\downloads\\FiscalBox-Knjigovodja-Setup.msi
```

Nakon toga uraditi standardni Next.js build/deploy. Tek tada će dugme „Preuzmi FiscalBox KNJIGO (.MSI)“ u podešavanjima knjigovođe imati fizički MSI fajl.

## Obavezno pre javne distribucije

MSI treba digitalno potpisati važećim Windows code-signing sertifikatom. Bez potpisa Windows/SmartScreen može prikazati upozorenje. Nemojte korisnicima predstavljati nepotpisan MSI kao finalni produkcioni installer.
