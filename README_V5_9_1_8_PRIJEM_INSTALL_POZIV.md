# FiscalBox V5.9.1.8 — prijem, mobilna instalacija i poziv knjigovođi

## Izmene

- Na KNJIGO dashboardu veliki broj u karticama prijema prikazuje samo **nove** fiskalne račune / dokumente koji čekaju raspoređivanje.
- Nazivi su promenjeni u **Fiskalni računi svih klijenata** i **Dokumenti svih klijenata**.
- Posle uspešnog `Preuzmi sve` prikazuje se popup **Baza je ažurirana** i broj novih stavki pada na 0.
- Registracija firme sada stvarno obrađuje kontakt knjigovođe iz poslednjeg koraka i šalje email/SMS kroz isti `connection_requests` sistem kao dashboard.
- Ako firma već ima aktivno povezivanje sa knjigovođom, opcija za slanje novog zahteva se više ne prikazuje u USER meniju.
- Posle registracije na mobilnom uređaju automatski se prikazuje instalacioni korak za FiscalBox PWA.
- U KNJIGO podešavanjima dodat je Windows setup fajl `FiscalBox-Knjigovodja-Setup.cmd` koji pravi desktop i Start meni prečicu i otvara FiscalBox u posebnom Edge/Chrome prozoru.

## SQL
Nema nove SQL migracije za V5.9.1.8.

## Email
Za slanje poziva knjigovođi i dalje moraju biti podešeni:

- `RESEND_API_KEY`
- `APP_EMAIL_FROM`

Za SMS su potrebni Twilio parametri iz prethodnih verzija.
