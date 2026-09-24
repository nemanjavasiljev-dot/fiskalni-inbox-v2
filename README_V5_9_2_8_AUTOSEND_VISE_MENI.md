# FiscalBox V5.9.2.8 — Automatsko slanje i stabilan meni Više

- Kada je `receipt_send_schedule` `weekly` ili `monthly`, ručno dugme „Pošalji knjigovođi“ je zaključano i jasno prikazuje aktivni automatski režim.
- Kada je raspored `manual`, ručno slanje je ponovo dostupno.
- Meni „Više“ je prebačen u portal na `document.body`, iznad bottom navigacije i svih stacking context-a.
- Na telefonu se „Više“ otvara kao kompletan full-screen meni sa sopstvenim skrolom, bez obzira na poziciju stranice.
- Otvoren meni zaključava pozadinski scroll; zatvara se dugmetom, klikom na pozadinu ili ESC tasterom.
- Nema SQL migracije.
