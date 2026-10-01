# FiscalBox V5.9.2.1 — SUPER ADMIN responsive

Ova verzija menja samo SUPER ADMIN / MASTER upravljačku konzolu i UX prikaza.

## Desktop
- zadržan stalni levi meni i široki dashboard
- KPI, grafikoni, tabele i forme ostaju optimizovani za veliki ekran

## Mobilni / tablet
- SUPER ADMIN dobija poseban sticky mobilni header
- hamburger meni otvara bočni drawer sa svim funkcijama
- dodir izabrane stavke automatski zatvara meni
- KPI kartice su 2 po redu na telefonu
- složene forme i paneli se slažu u jednu kolonu
- široke tabele imaju horizontalno skrolovanje
- filteri se skroluju horizontalno
- input polja koriste 16px font radi sprečavanja automatskog zoom-a na telefonu
- dugmad imaju veće touch zone

## Bezbednost
Nije vraćen nesiguran MASTER/MASTER bootstrap. SUPER ADMIN i dalje koristi potvrđen FiscalBox nalog sa `global_role = master_admin` i isti `/login` kao ostali korisnici.

## SQL
Nema nove SQL migracije za V5.9.2.1.
