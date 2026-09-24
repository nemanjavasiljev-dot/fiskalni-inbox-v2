# FiscalBox V5.9.1 MERGE

Ovo je merge paket V5.8.9 + bezbednosna revizija V5.9.0. V5.9.0 nije direktno deployovan preko V5.8.9 zato što je revizija bila zasnovana na V5.8.8 i nije sadržala banku, IPS predračune ni masovno preuzimanje knjigovođe.

## Šta je zadržano

- predračun → email → Moji računi / Neplaćeno,
- NBS IPS QR za uplatu,
- finalni račun nakon verifikovane uplate,
- banka/uplate u MASTER konzoli,
- bank webhook i generički bank API adapter,
- Basic 1.250 RSD i Premium 2.000 RSD,
- ALSET CO. nije u sistemu PDV-a,
- knjigovođa: prijem fiskalnih računa i dokumenata,
- Preuzmi sve račune i Preuzmi sve dokumente.

## Bezbednosne izmene

Prenete su izmene iz V5.9.0 revizije: stroga PIB validacija, NBS parser/adapters, OAuth safe redirect, strože dozvole i RLS, bezbedniji upload dokumenata, konzervativna fiskalna verifikacija, CSV formula zaštita, sigurniji webhook tok, PWA cache i uklanjanje javnog MASTER/MASTER bootstrap-a.

## Nove merge zaštite

- `settle_bank_proforma` radi finalizaciju predračuna, pretplate, bankarske transakcije i finalnog računa u jednoj DB transakciji.
- Plaćanje ne uklanja eksplicitnu MASTER suspenziju.
- `Preuzmi sve` ne veruje samo starom `organization_members` redu: proverava aktivnu `accountant_company` vezu, administratorsku ulogu ili dodelu zaposlenom i status usluge.
- Bank webhook ima constant-time proveru tajne, limit payload-a i limit broja transakcija.
