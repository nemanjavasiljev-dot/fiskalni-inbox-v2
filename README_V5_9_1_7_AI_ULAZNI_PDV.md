# FiscalBox V5.9.1.7 — AI predlog ulaznog PDV-a + konačna odluka knjigovođe

## Šta je novo

- Ispravljen Vercel/TypeScript build problem u `components/NotificationRuntime.tsx` (`renotify` više nije prosleđen tipu koji ga ne podržava u trenutnom DOM typings paketu).
- Fiskalni račun koji otvori knjigovođa dobija **AI predlog za odbitni/ulazni PDV**: `DA`, `NE` ili `PROVERA`.
- AI procena koristi delatnost klijenta (`activity_code`/`activity_name`), podatke i stavke fiskalnog računa, PIB kupca, status verifikacije i evidentirani PDV.
- AI je samo pomoć pri odlučivanju. **Konačnu odluku uvek donosi knjigovođa.**
- Dugme `Zatvori račun` traži obaveznu odluku `PDV DA` ili `PDV NE` ako odluka još nije doneta.
- Ako knjigovođa pokuša da zatvori browser tab bez odluke, browser prikazuje standardno upozorenje o napuštanju stranice.
- U zbir **Ulazni PDV** ulaze samo računi za koje je konačna odluka knjigovođe `PDV DA`.
- Na listi računa se vidi konačna odluka ili AI predlog dok odluka čeka potvrdu.
- Odluke se čuvaju sa korisnikom i vremenom, a istorija odluka ide u audit tabelu `receipt_vat_decision_log`.
- CSV i arhivski PDF dobijaju status odbitnog PDV-a.

## Obavezno pre deploy-a

U Supabase SQL Editor-u pokrenuti:

`SQL_025_AI_ULAZNI_PDV_ODLUKA.sql`

SQL je idempotentan i može bezbedno da se pokrene jednom na postojećoj V5.9.1.x bazi.

## Napomena

AI procena je sistem podrške odluci i ne predstavlja poresko mišljenje. Posebne situacije (reprezentacija, vozila, gorivo, smeštaj, hrana i slične stavke) automatski idu na `PROVERA` kada ih sistem prepozna. Konačni poreski tretman potvrđuje knjigovođa.
