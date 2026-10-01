# Validacija V5.9.4.0

- OPASNA ZONA koristi listu organizacija iz master baze.
- Pretraga: naziv / PIB / MB.
- Organizacija mora biti eksplicitno odabrana iz liste.
- DELETE ostaje blokiran ako izabrani ID nije ID trenutno otvorene organizacije.
- OBRISI ostaje obavezna završna potvrda.
- Nema nove SQL migracije.
- Statička provera: 188 TS/TSX, 0 sintaksnih grešaka.
