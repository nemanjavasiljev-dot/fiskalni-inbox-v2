# FiscalBox V4.5 — deploy

V4.5 dodaje:

- USER / Fajlovi: pravi skener dokumenta preko kamere, Fotografisi i Dodaj fajl.
- USER / Vise / Moji racuni: arhiva FiscalBox predracuna/racuna, placeno/neplaceno i PDF download.
- WEB: 2x veci logo na desktop landing strani; kompaktan mobile header; Fiscal/Box wordmark sa zelenim `Box`.
- Paketi: Basic 1.250 RSD + PDV, Premium 1.790 RSD + PDV, Trial 10 dana.
- Paid registracija automatski kreira predračun; kada je Resend konfigurisan PDF se salje emailom.
- KNJIGO: desktop meni sa Pregled, Moji klijenti, Moji racuni, Notifikacije, Moji zaposleni, Podesavanja i Instaliraj app.
- PWA/Desktop install dugme i postojeći manifest/service-worker ostaju aktivni.

## 1. Supabase — obavezno prvo

U Supabase -> SQL Editor pokrenite:

`supabase/migrations/007_v4_5_billing.sql`

Ocekujte `Success. No rows returned`.

Migracija kreira demo izdavaoca `FiscalBox Demo` i billing arhivu. Demo PDF je jasno oznacen kao DEMO PREDRACUN / nije poreski dokument. Pre komercijalnog pustanja zameniti podatke izdavaoca stvarnim podacima firme.

## 2. Email predračuna — opciono, ali potrebno za automatsko slanje

U Vercel Environment Variables dodajte ako vec nisu postavljeni:

- `RESEND_API_KEY`
- `APP_EMAIL_FROM`

Ako nisu podeseni, predračun se i dalje kreira i pojavljuje u `Moji racuni`, ali email se ne salje.

## 3. Kopiranje patch-a

Raspakujte `FiscalBoxV4_5_Patch.zip`.

Kopirajte SADRZAJ patch foldera direktno preko lokalnog Git repozitorijuma `fiskalni-inbox-v2`.

Ne kopirajte ceo spoljasnji folder kao podfolder i ne brisite `.git`.

## 4. GitHub Desktop

Summary:

`Upgrade FiscalBox to V4.5`

Zatim:

- Commit to main
- Push origin

Vercel automatski pokrece novi deployment.

## 5. Test posle deploy-a

USER:
- Fajlovi -> Skeniraj dokument
- Fajlovi -> Fotografisi
- Fajlovi -> Dodaj fajl
- Vise -> Moji racuni
- PDF download predračuna/racuna

WEB:
- desktop landing logo
- mobile header
- Basic 1.250 + PDV
- Premium 1.790 + PDV
- Registracija iz odabranog paketa
- Install app dugme

KNJIGO:
- desktop levi MENI
- Moji klijenti
- Moji racuni
- Notifikacije
- Moji zaposleni (admin)
- Podesavanja
- Instaliraj app

## Napomena o instalaciji

FiscalBox je PWA. Native install prompt zavisi od browsera/OS-a. Kada browser ne izlozi automatski prompt, aplikacija prikazuje odgovarajuce uputstvo za Install app / Add to Home Screen / Add to Dock gde je podrzano.
