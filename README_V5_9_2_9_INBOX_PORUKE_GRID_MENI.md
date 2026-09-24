# FiscalBox V5.9.2.9 — Inbox poruke + Notifikacije + grid meni Više

## Novo
- USER/FIRMA i KNJIGOVOĐA imaju dve stalno vidljive ikone: **Poruke** (koverta) i **Notifikacije** (zvono).
- Ikone prikazuju broj nepročitanih stavki i osvežavaju broj na 5 sekundi.
- Nova ruta `/app/messages` je kompletan inbox sa karticama **Primljene / Poslate / Nepročitane**.
- Moguće je poslati novu poruku, odgovoriti, označiti kao pročitano/nepročitano i obrisati poruku iz sopstvenog inboxa.
- Poruke se mogu slati samo između povezanih USER/FIRMA i KNJIGOVOĐA naloga, kao i prema SUPER ADMIN-u.
- Nova poruka generiše push/notifikaciju primaocu i vodi u `/app/messages`.
- Notifikacije ostaju odvojene u `/app/notifications` i zadržavaju reakcije (Primljeno, Važno, Hvala, Završeno).
- Meni **Više** kod USER/FIRMA je preuređen u pregledan grid blokova.
- I u Fajlovi prikazu meni **Više** koristi isti grid princip.

## Obavezno
Pre deploy-a u Supabase SQL Editoru pokrenuti:

`SQL_028_INBOX_PORUKE.sql`

Novi SQL kreira tabelu `public.user_messages`, indekse i RLS pravila.

## SQL
- `SQL_028_INBOX_PORUKE.sql`
- `supabase/migrations/028_v5_9_2_9_inbox_messages.sql`
