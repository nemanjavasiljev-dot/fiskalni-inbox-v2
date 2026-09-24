# FiscalBox 5.9.1 MERGE

FiscalBox 5.9.1 spaja produkcione funkcije iz 5.8.9 sa bezbednosnom revizijom 5.9.0.

Zadržano iz 5.8.9:
- automatski predračun pri izboru pretplate,
- PDF + NBS IPS QR,
- banka/uplate i automatsko ili ručno rasknjižavanje,
- finalni račun posle verifikovane uplate,
- knjigovođa: prijem računa i dokumenata + odvojeno Preuzmi sve,
- Basic 1.250 RSD i Premium 2.000 RSD, izdavalac ALSET CO. van sistema PDV-a.

Preneto iz 5.9.0 revizije:
- bezbedniji MASTER nalog bez javnog MASTER/MASTER bootstrap-a,
- stroža RLS i server-side autorizacija,
- zaštita registracije, povezivanja, OAuth-a, dokumenata i CSV izvoza,
- stroža PIB/NBS validacija,
- bezbednija fiskalna QR provera,
- transakcijska Lemon Squeezy obrada,
- sigurniji PWA cache,
- regresioni testovi i syntax check.

Dodatno u 5.9.1:
- V5.8.9 SQL je renumerisan posle security migracija da nema kolizije sa starim SQL 017,
- bankarsko rasknjižavanje je prebačeno u atomsku SQL transakciju,
- MASTER suspenzija se ne uklanja automatski običnim knjiženjem uplate,
- masovno preuzimanje knjigovođe ponovo proverava aktivnu vezu, ulogu/dodelu i aktivnu uslugu,
- bank webhook koristi constant-time proveru tajne i ograničenje veličine zahteva.

Detaljno pokretanje: `POKRETANJE_V5_9_1.md`.
