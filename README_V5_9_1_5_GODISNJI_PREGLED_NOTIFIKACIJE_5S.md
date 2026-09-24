# FiscalBox V5.9.1.5 — godišnji pregled + proveravanje notifikacija na 5 sekundi

## Knjigovođa / klijent — obračunski period
- Padajući meni više nije samo mesečni.
- Dodata je grupa **Godišnji pregled** sa opcijama **Cela YYYY. godina**.
- Godišnji pregled sabira račune, dokumente, preuzete stavke i ulazni PDV za celu izabranu godinu.
- Iz godišnjeg pregleda rade i „Preuzmi sve račune/dokumente“ za celu izabranu godinu.
- Mesečni pregled ostaje nepromenjen i kompatibilan sa starim URL-ovima `?month=YYYY-MM`.

## Dashboard knjigovođe — notifikacije
- Dashboard proverava nove notifikacije automatski na svakih **5 sekundi**.
- Provera je preko posebnog laganog endpointa `/api/accountant/notifications`.
- Prate se novi zahtevi za povezivanje, novi računi i novi dokumenti.
- Kada se stanje promeni, osvežava se i server-side dashboard kako bi KPI kartice bile ažurne.
- Web Push ostaje aktivan nezavisno za Windows/background obaveštenja.

## SQL
Nema novog SQL-a za V5.9.1.5.
