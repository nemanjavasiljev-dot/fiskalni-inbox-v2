# FiscalBox V5.9.3.5 — Knjigovođa bez pretplate + automatski mesečni predračuni

Osnova: V5.9.3.4.

## Šta je promenjeno

### 1. Knjigovođa ne plaća FiscalBox pretplatu
- Knjigovodstvena organizacija više ne zavisi od `subscriptions` statusa za pristup aplikaciji.
- U registraciji knjigovođe više nema izbora BASIC/PREMIUM, trial-a ni dugmeta za plaćanje.
- Stranica `/app/subscription` vraća knjigovođu na dashboard.
- Checkout i subscription portal API blokiraju pokušaj naplate knjigovodstvene organizacije.
- U accountant dashboard meniju nema stavke Pretplata.
- U billing pregledu knjigovođe nema dugmeta Pretplata.

### 2. Knjigovođa bira paket klijenta
Kod dodavanja/pozivanja klijenta knjigovođa bira:
- BASIC — 1.250 RSD mesečno
- PREMIUM — 1.790 RSD mesečno

Izabrani paket se čuva u pozivu (`requested_plan`). Kada novi klijent registruje/aktivira nalog iz poziva knjigovođe, taj paket ima prednost i sistem automatski pokušava da kreira i pošalje prvi predračun.

Za postojeću firmu koja prihvati zahtev knjigovođe, izabrani paket se upisuje na klijenta. Ako nema trenutno plaćen aktivan period, sistem pokušava odmah da napravi predračun.

### 3. Automatski mesečni predračuni
Posle prve potvrđene uplate predračuna sistem pamti:
- datum prve uplate (`first_paid_at`),
- originalni dan obračuna (`billing_anchor_day`),
- datum sledećeg predračuna (`next_proforma_at`).

Primer: prva uplata 31.01. → sledeći predračun 28.02. (ili 29.02. u prestupnoj godini) → zatim 31.03.

Jedan mesečni ciklus može imati najviše jedan predračun po firmi (`billing_cycle_on` + unique index), tako da paralelni/retry cron pozivi ne prave duplikate.

### 4. MASTER kontrola
MASTER > Računi / predračuni prikazuje tabelu **AUTOMATSKI PREDRAČUNI** sa:
- klijentom,
- paketom,
- prvom uplatom,
- sledećim predračunom,
- poslednjim automatskim predračunom,
- dugmetom **Zaustavi / Aktiviraj**.

Ako MASTER zaustavi automatiku, nova uplata je ne uključuje ponovo automatski.

## SQL — OBAVEZNO
Ova verzija zahteva novu migraciju:

`SQL_030_KNJIGOVODJA_FREE_AUTO_PREDRACUN.sql`

Ista migracija se nalazi i kao:

`supabase/migrations/030_v5_9_3_5_accountant_free_auto_proforma.sql`

Pokrenuti je **jednom** na bazi koja je već na SQL_029.

## Cron — OBAVEZNO ZA SELF-HOSTED SERVER
Endpoint:

`GET /api/cron/monthly-proformas`

Header:

`Authorization: Bearer <CRON_SECRET>`

Preporuka: pozvati jednom dnevno, npr. u 04:10.

Vercel konfiguracija je već dopunjena u `vercel.json`.

Za sopstveni server primer:

```cron
10 4 * * * curl -fsS -H "Authorization: Bearer VAŠ_CRON_SECRET" https://VAŠ-DOMEN/api/cron/monthly-proformas >/dev/null 2>&1
```

Postojeći cron za automatsko slanje fiskalnih računa ostaje zaseban.

## Važno za automatsko slanje prvog predračuna
Da bi se predračun stvarno kreirao/poslao, MASTER billing konfiguracija mora imati:
- aktivnog produkcionog izdavaoca,
- tekući račun,
- ispravan email/Resend setup.

Registracija klijenta neće biti oborena ako email/predračun servis privremeno nije dostupan; greška se loguje radi dijagnostike.

## Validacija
- package version: `5.9.3.5`
- TypeScript/TSX syntax check: 176 fajlova, 0 sintaksnih grešaka
- testirana logika mesečnog anchora: 29/30/31 i prelazak godine
- kompletan `npm test` nije moguće potvrditi iz source ZIP-a bez `node_modules`/instaliranih zavisnosti; na deployment mašini pokrenuti `npm install`, `npm test`, `npm run build`.
