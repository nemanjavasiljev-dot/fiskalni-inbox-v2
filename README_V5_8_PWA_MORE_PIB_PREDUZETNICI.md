# FiscalBox V5.8 — Desktop PWA, mobilni Više, PIB i preduzetnici

## Šta je popravljeno

### 1. Desktop instalacija / PWA
- Manifest je sada statički `public/manifest.webmanifest` da Chromium dobije stabilan URL i MIME tip.
- `beforeinstallprompt` listener se postavlja u `<head>` pre React hidratacije, tako da se rani Chromium događaj više ne propušta.
- Service Worker se registruje rano, čisti stare FiscalBox cache verzije i dobija `Service-Worker-Allowed: /`.
- Vercel ne kešira `sw.js`, a manifest se služi kao `application/manifest+json`.
- Zadržana su oba install dugmeta na početnoj strani.

Napomena: Chrome sam odlučuje kada prikazuje ikonicu u adresnoj liniji. Aplikacija sada ispunjava standardne PWA uslove i hvata nativni prompt čim ga Chrome/Edge emituju, ali web stranica ne može silom da nacrta Chromium sistemsku ikonicu.

### 2. Mobilni USER → Više
- Bottom sheet ima ograničenu visinu i sopstveni vertikalni scroll.
- Zaglavlje/Zatvori ostaje vidljivo.
- Dodat je donji prostor iznad fiksne mobilne navigacije i safe-area zone.

### 3. PIB pretraga
- APR sync sada pokušava da iz originalnog `apr_raw` zapisa izvuče PIB po eksplicitnim PIB/tax ključevima.
- SQL 014 pokušava da popuni PIB i iz već postojećih `apr_raw` zapisa bez ponovnog download-a.
- Bulk upsert je popravljen: kod postojećeg MB-a sada ažurira i `pib`. Ranije je PIB mogao zauvek da ostane NULL iako ga novi sync pošalje.
- Posle SQL 014 obavezno ponovo pokrenuti `APR Open Data Sync`.

### 4. Preduzetnici
- Centralna tabela `companies` sada ima `registry_kind = company | entrepreneur | other`.
- Isti CompanySearch prikazuje i društva i preduzetnike čim su podaci uvezeni.
- Dodat je GitHub Actions workflow `APR Entrepreneurs Sync`.
- Workflow NE izmišlja APR endpoint. Potrebno je uneti zvanični APR feed/web-servis koji imate pravo da koristite u secret `APR_ENTREPRENEURS_DATA_URL` i odgovarajuće kredencijale ako su potrebni.

APR zvanično navodi da su podaci preduzetnika dostupni kroz njihove internet pretrage i web-servise i da neovlašćeno automatizovano preuzimanje nije dozvoljeno. Zato FiscalBox ne radi scraping APR sajta.

## Obavezni koraci za deploy
1. Pokreni `SQL_014_REGISTAR_PIB_PREDUZETNICI.sql` u Supabase SQL Editor-u.
2. Deploy V5.8 na GitHub/Vercel.
3. GitHub → Actions → `APR Open Data Sync` → Run workflow (da ponovo pokuša popunu PIB-a za privredna društva).
4. Za preduzetnike: pribavi zvaničan APR web-service/feed ili izvoz, dodaj GitHub secrets `APR_ENTREPRENEURS_DATA_URL` i eventualne kredencijale, pa pokreni `APR Entrepreneurs Sync`.
5. Za NBS PIB proveru u realnom vremenu i dalje su potrebni `NBS_USERNAME`, `NBS_PASSWORD`, `NBS_LICENCE_ID` koje izdaje NBS.

## Brze provere
```sql
select registry_kind, count(*)
from public.companies
group by registry_kind
order by registry_kind;

select count(*) as sa_pibom
from public.companies
where pib is not null;

select *
from public.search_companies('NAZIV PREDUZETNIKA', 15);
```
