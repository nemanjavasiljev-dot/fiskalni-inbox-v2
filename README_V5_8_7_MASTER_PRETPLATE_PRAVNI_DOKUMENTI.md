# FiscalBox V5.8.7 — MASTER pretplate + pravni dokumenti

## MASTER konzola
- Posebna sekcija **Firme** prikazuje samo registrovane firme.
- Posebna sekcija **Knjigovođe** prikazuje knjigovodstvene organizacije i postojeće korisničke privilegije.
- Filteri: Sve / Plaćene / Neplaćene / Suspendovane.
- Plaćene ili aktivne probne pretplate su svetlo zelene.
- Neplaćene su svetlo crvene.
- Suspendovane su posebno crveno označene.
- MASTER može da suspenduje i ponovo aktivira uslugu.
- Prikazuju se paket, status pretplate, poslednje plaćanje i datum važenja/obnove.

## Vlasnik FiscalBox-a
**OSKAR ZOMBORI PR ALSET CO.**
- Adresa: Sterijina 29, sprat 2, stan 13, 24000 Subotica, Srbija
- Vlasnik: Oskar Zombori
- Datum osnivanja: 17. septembar 2025.
- MB: 68230403
- PIB: 115266735

## Javni pravni dokumenti
- `/politika-privatnosti`
- `/uslovi-koriscenja`

Linkovi su dodati na početnu stranu, login i registraciju.

## SQL
Za ovu verziju nema nove SQL migracije. Koristi postojeću tabelu `subscriptions` i postojeći MASTER endpoint za aktivaciju/suspenziju usluge.

## Napomena
Tekstovi politike privatnosti i uslova korišćenja su produkcioni nacrt. Pre komercijalnog puštanja preporučena je završna provera pravnika i usklađivanje sa stvarnim ugovorima sa procesorima podataka, servisom naplate, hostingom i servisima za poruke.
