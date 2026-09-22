# Fiskalni Inbox V4.2 — KNJIGO

## Šta je dodato

- KNJIGO početni dashboard za sve dodeljene klijente.
- Tekući mesec je podrazumevani prikaz, uz prebacivanje na ukupno.
- Kartice: novi/neotvoreni dokumenti, novi/neotvoreni računi, preuzeti računi, preuzeti dokumenti.
- In-app notifikacije za nove dokumente.
- Rokovi: obračun prethodnog meseca i fakture do 10. u mesecu; PDV prijava 15. u mesecu.
- Lista klijenata sa brojem novih računa/dokumenata i PDV pregledom.
- Klik na klijenta otvara zaseban workspace.
- Računi: status NOV/NEPREUZET, OTVOREN, PREUZET; Preuzmi/PDF; direktna štampa.
- Dokumenti: Otvori i Preuzmi, sa statusom po knjigovođi.
- Ulazni PDV sa fiskalnih računa po klijentu i obračunskom mesecu.
- Mesečna arhiva klijenta.
- Demo `knjigo / knjigo` osvežen za KNJIGO pregled.

## 1. Supabase — obavezno prvo

Pokrenite u SQL Editor-u:

`supabase/migrations/004_v4_2_accountant_workspace.sql`

Očekivani rezultat: `Success. No rows returned`.

Migracija kreira odvojene statuse po knjigovođi za račune i dokumente. Time više knjigovođa mogu imati nezavisan status otvoreno/preuzeto.

## 2. GitHub

Kopirajte SADRŽAJ ovog patch foldera direktno preko lokalnog `fiskalni-inbox-v2` repozitorijuma. Ne kopirajte spoljašnji `FiskalniInboxV4_2_Patch` folder kao podfolder.

GitHub Desktop Summary:

`Add V4.2 accountant workspace`

Zatim `Commit to main` -> `Push origin`.

## 3. Vercel

Nisu potrebne nove environment promenljive za V4.2.

Sačekajte da deployment bude `Ready`.

## 4. Test

Prijavite se kao pravi knjigovođa. Za demo koristite `knjigo / knjigo`.

Testirajte:
- početni KNJIGO dashboard;
- klijente;
- neotvorene dokumente;
- status računa;
- Preuzmi/PDF i Štampaj;
- Dokument Otvori/Preuzmi;
- Ulazni PDV;
- promenu obračunskog meseca i arhivu.

## Napomena za PDV

Prikaz "Ulazni PDV" sabira `total_tax` evidentiran na fiskalnim računima u aplikaciji za izabrani mesec. To je operativni pregled fiskalnih računa; konačni poreski tretman i pravo na odbitak ostaju predmet knjigovodstvene/profesionalne kontrole.
