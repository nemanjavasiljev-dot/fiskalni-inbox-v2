# FiscalBox V5.8.4 — Ručna registracija firme / knjigovođe

Kada automatska PIB ili APR pretraga ne radi ili ne pronalazi subjekt, registracija sada nudi **Unesi ručno**.

Ručni unos obuhvata:
- vrstu subjekta (privredno društvo / preduzetnik / drugi pravni subjekt),
- pun i skraćen naziv,
- PIB,
- matični broj,
- pravnu formu i status,
- adresu, mesto, opštinu i poštanski broj,
- šifru i naziv delatnosti,
- kontakt email i telefon firme.

Minimalno je potrebno uneti naziv i najmanje jedan identifikator: PIB ili matični broj.

Ručni zapis se čuva u centralnoj `companies` tabeli kao `manual_review`, označen je za naknadnu proveru i dobija isti `company_id` mehanizam kao APR/NBS zapisi. Ako PIB ili MB već postoji u bazi, FiscalBox koristi postojeći zapis umesto pravljenja duplikata.

Nije potrebna nova SQL migracija ako su prethodne V5.8 migracije već primenjene.
