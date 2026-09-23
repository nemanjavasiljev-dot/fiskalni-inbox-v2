# FiscalBox V5.6.2 — Desktop Install Fix

Ispravljena PWA/desktop instalacija na oba dugmeta početne strane.

## Šta je promenjeno
- `beforeinstallprompt` se hvata globalno pre React hidratacije, tako da se događaj više ne gubi.
- Oba dugmeta dele isti install prompt i otvaraju pravi Chrome/Edge sistemski prozor kada je dostupan.
- Service Worker se registruje za ceo `/` scope i odmah proverava novu verziju.
- Manifest sada eksplicitno ima `id`, `scope`, javni `start_url` i potrebne 192/512 ikone.
- Ako browser ne dozvoli direktni prompt, dugme prikazuje jasno uputstvo umesto da deluje kao da ne radi.
- Dodata detekcija već instalirane aplikacije.
- Promenjen SW cache na `fiscalbox-public-v2` da stari cache ne zadrži prethodnu logiku.

## Posle deploy-a
1. Vercel mora završiti novi deployment.
2. Otvoriti produkcioni domen u Chrome/Edge-u.
3. Uraditi jedan hard refresh (`Ctrl+F5`) ako je stari service worker već bio aktivan.
4. Kliknuti bilo koje `Instaliraj` dugme na početnoj strani.

Ako je FiscalBox već instaliran, dugme će prikazati da je instalacija već aktivna.
