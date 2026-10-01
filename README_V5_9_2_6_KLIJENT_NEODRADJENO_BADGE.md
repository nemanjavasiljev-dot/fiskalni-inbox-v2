# FiscalBox V5.9.2.6 — neodrađene stavke po klijentu

Na karticama klijenata u KNJIGOVOĐA dashboardu dodat je mali brojač u gornjem desnom uglu.

Brojač prikazuje ukupan broj trenutno neodrađenih stavki za klijenta:
- fiskalni račun je neodrađen dok nije preuzet/PDF ili odštampan;
- dokument je neodrađen dok nije preuzet.

Brojač je nezavisan od izabranog perioda da knjigovođa uvek vidi realan zaostali posao.
Klik/hover nad oznakom prikazuje razlaganje na račune i dokumente.
Kada nema neodrađenih stavki prikazuje se zeleno 0.

Nema nove SQL migracije.
