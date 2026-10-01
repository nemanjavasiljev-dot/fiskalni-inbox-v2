# VALIDACIJA FiscalBox V5.9.4.1

- Paket osnova: V5.9.4.0
- Nova verzija: 5.9.4.1
- `node scripts/check-syntax.cjs`: 188 proveravanih TS/TSX fajlova, 0 sintaksnih grešaka
- Ciljani assertions: 7/7 OK
- Brisanje uklonjeno iz MasterOrganizationEditor / OPASNE ZONE
- Kanta dodata uz `Otvori / edituj` za firme i knjigovođe
- DELETE zahtev zahteva potvrdu i server-side PIN
- Podrazumevani PIN: 5203; može se promeniti preko `MASTER_DELETE_PIN`
- Pogrešan PIN: HTTP 403, bez izmene baze
- Nema nove SQL migracije; poslednja ostaje SQL_032
- Produkcioni `npm test` i `npm run build` treba izvršiti nakon `npm install` na razvojnom/server računaru.
