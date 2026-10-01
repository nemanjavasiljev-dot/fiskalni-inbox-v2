# FiscalBox V5.9.1.2 – prijem i raspoređivanje kod knjigovođe

Na glavnom dashboardu knjigovođe dugmad **Preuzmi sve račune** i **Preuzmi sve dokumente** više ne generišu ZIP niti preuzimaju fajlove.

Sada rade kao prijemna obrada:

1. uzimaju sve nove stavke koje su klijenti poslali knjigovođi;
2. koriste postojeći `organization_id` svake stavke da je automatski rasporede tačnom klijentu;
3. označavaju stavke kao primljene/raspoređene za prijavljenog knjigovođu;
4. osvežavaju dashboard i broj novih stavki;
5. prikazuju zbir po klijentima, npr. `CYBERSHIELD: 4 · XY: 6`.

Preuzimanje PDF-a, originalnog dokumenta i štampa ostaju isključivo unutar konkretnog klijenta (`FIRMA-klijent`).

Nema nove SQL migracije – koristi postojeće `accountant_receipt_status` i `accountant_document_status` tabele.

## Ponašanje klijentskih kartica

Dok stavke čekaju u sekciji **PRIJEM**, one se ne računaju kao raspoređene u karticama klijenata.
Tek nakon klika na **Preuzmi sve račune** / **Preuzmi sve dokumente** stavke se označavaju kao primljene i pojavljuju se kod odgovarajućih klijenata.

Unutar konkretnog klijenta ostaju akcije za PDF, pojedinačno preuzimanje, štampu i arhivu.
