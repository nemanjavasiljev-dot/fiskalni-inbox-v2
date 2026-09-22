# FiscalBox V5 — PRODUKCIJA

V5 uklanja javne demo naloge i demo podatke. Aplikacija koristi stvarne Supabase naloge i stvarne organizacije.

## Šta je produkciono u V5

- username + password prijava preko Supabase Auth
- registracija FIRMA / KNJIGOVOĐA
- oporavak zaboravljene lozinke
- Basic i Premium pretplate po broju aktivnih korisničkih mesta
- Basic: 1.250 RSD + porez / korisnik / mesečno
- Premium: 1.790 RSD + porez / korisnik / mesečno
- 10 dana besplatno bez kartice za BASIC ili PREMIUM
- tokom trial-a rade funkcije iz izabranog paketa
- po isteku trial-a poslovni podaci ostaju sačuvani, ali je radni deo zaključan dok se ne aktivira pretplata
- realan hosted checkout, subscription lifecycle, renewal, otkazivanje, neuspešna naplata, customer portal i provider računi
- broj zaposlenih u knjigovodstvenoj agenciji usklađuje količinu korisničkih mesta u pretplati pri dodavanju zaposlenog
- MASTER provizija knjigovođima ne obračunava besplatne trial korisnike
- MASTER ručni račun/predračun zahteva stvarne podatke izdavaoca; seedovani demo izdavalac se V5 migracijom deaktivira

## 1. Supabase migracija

U Supabase -> SQL Editor pokrenite:

`supabase/migrations/009_v5_production_subscriptions.sql`

Očekivano: `Success. No rows returned`.

Migracija:
- prebacuje stare lažne `active` pretplate bez payment providera u `pending_checkout`,
- zadržava postojeći važeći trial samo do stvarnog datuma isteka,
- dodaje provider/customer/subscription/payment podatke,
- dodaje webhook audit/dedupe,
- zaključava poslovne RLS podatke po isteku trial-a ili neaktivnoj pretplati,
- ostavlja korisniku pristup osnovnim account/subscription podacima kako bi mogao ponovo da aktivira uslugu,
- deaktivira DEMO izdavaoca ručnih računa.

## 2. Payment provider — Lemon Squeezy LIVE

V5 je pripremljen za Lemon Squeezy kao Merchant of Record.

Napravite/aktivirajte LIVE store i postavite store currency na RSD.

U store General Settings isključite tax-inclusive pricing ako želite model prikaza `1.250 RSD + porez` / `1.790 RSD + porez`.

Napravite jedan subscription proizvod sa dve mesečne, quantity-based varijante:

- Basic — 1.250 RSD po jedinici / mesečno
- Premium — 1.790 RSD po jedinici / mesečno

Nemojte dodavati provider trial na varijante. FiscalBox vodi sopstveni, tačno 10-dnevni trial bez kartice.

Zapišite:
- Store ID
- Basic Variant ID
- Premium Variant ID

Napravite LIVE API key.

## 3. Vercel Environment Variables

Dodajte u Production:

```text
LEMONSQUEEZY_API_KEY=...
LEMONSQUEEZY_STORE_ID=...
LEMONSQUEEZY_BASIC_VARIANT_ID=...
LEMONSQUEEZY_PREMIUM_VARIANT_ID=...
LEMONSQUEEZY_WEBHOOK_SECRET=...
```

Postojeći Supabase ključevi ostaju:

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
NEXT_PUBLIC_APP_URL=https://VAS-DOMEN
```

Secret vrednosti nikada ne stavljajte u GitHub.

## 4. LIVE webhook

U Lemon Squeezy -> Settings -> Webhooks napravite webhook:

`https://VAS-DOMEN/api/webhooks/lemonsqueezy`

Signing secret mora biti isti kao `LEMONSQUEEZY_WEBHOOK_SECRET` u Vercel-u.

Izaberite događaje:
- subscription_created
- subscription_updated
- subscription_cancelled
- subscription_resumed
- subscription_expired
- subscription_paused
- subscription_unpaused
- subscription_payment_success
- subscription_payment_failed
- subscription_payment_recovered
- subscription_payment_refunded

V5 proverava HMAC `X-Signature`, beleži hash webhook-a i ne obrađuje isti event dva puta.

## 5. Trial

Prilikom registracije korisnik prvo bira paket BASIC ili PREMIUM, zatim bira:

- `Probaj 10 dana besplatno`
- `Aktiviraj pretplatu odmah`

Trial:
- traje tačno 10 dana,
- ne traži karticu,
- nije zaseban paket: korisnik bira Basic-trial ili Premium-trial,
- posle isteka podaci se ne brišu,
- poslovni deo se zaključava dok se ne završi checkout.

I klijent koji dolazi preko poziva knjigovođe bira Basic ili Premium trial pre aktivacije.

## 6. Pretplata po korisniku

Checkout šalje `quantity` jednaku broju owner/employee korisnika organizacije.

Kod knjigovodstvene agencije, kreiranje novog zaposlenog pokušava da poveća subscription quantity. Ako provider odbije billing update, novi zaposleni se rollback-uje kako se ne bi napravilo neplaćeno korisničko mesto.

## 7. Računi za online pretplatu

Online subscription invoice dolazi od payment providera i čuva se u FiscalBox `Moji računi` arhivi preko webhook-a. Kada provider vrati originalni invoice URL, FiscalBox PDF dugme otvara originalni provider PDF.

MASTER ručni račun/predračun je odvojen tok. U MASTER -> Računi/predračuni prvo unesite stvarne podatke izdavaoca. V5 neće generisati produkcioni lokalni PDF ako je izdavalac prazan ili označen kao demo.

NAPOMENA: Lemon Squeezy je Merchant of Record. Ako želite da pretplatnički račun pravno izdaje baš vaša firma u Srbiji (umesto payment providera), treba zameniti online billing adapter lokalnim payment gateway / invoicing tokom i uskladiti ga sa vašim knjigovođom i poreskim zahtevima.

## 8. Password recovery

V5 dodaje:
- `/forgot-password`
- `/reset-password`

U Supabase -> Authentication -> URL Configuration proverite da je produkcioni domen dozvoljen i da `/auth/callback` može biti redirect ruta.

## 9. Ostale produkcione integracije

APR:
```text
APR_API_URL=...
APR_API_TOKEN=...
APR_API_TOKEN_HEADER=Authorization
APR_API_TOKEN_PREFIX=Bearer 
```

Email:
```text
RESEND_API_KEY=...
APP_EMAIL_FROM=FiscalBox <noreply@vas-domen.rs>
```

SMS pozivi, opciono:
```text
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=...
```

Push:
```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@vas-domen.rs
```

Automatsko slanje računa:
```text
CRON_SECRET=duga-nasumicna-vrednost
```

## 10. Produkcioni test pre puštanja korisnicima

1. Pokrenite SQL 009.
2. Deploy V5 patch.
3. Podesite LIVE store + API + webhook.
4. Registrujte novu TEST FIRMU sa Basic 10-day trial-om i proverite pristup.
5. Registrujte drugu sa Premium 10-day trial-om.
6. Proverite da kartica nije potrebna za trial.
7. Na kontrolnom nalogu pokrenite realan checkout i proverite `subscription_created` / `subscription_payment_success` webhook.
8. Proverite `Moji računi` i originalni provider invoice.
9. Proverite Customer Portal.
10. Proverite failed/cancelled subscription ponašanje.
11. U MASTER-u proverite da trial klijent ne ulazi u obračun 250 RSD knjigovođi.
12. Tek zatim pustite produkcione korisnike.

## Važno

Kod je produkciono pripremljen, ali "realna naplata" ne može raditi bez vaših LIVE payment-provider kredencijala, aktiviranog prodajnog naloga i LIVE webhook-a. Ne stavljajte tajne u repo niti ih šaljite u chat.
