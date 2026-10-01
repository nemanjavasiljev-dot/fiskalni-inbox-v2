# Validacija V5.9.3.9

- package verzija: 5.9.3.9
- SUPER ADMIN DELETE endpoint zahteva requireMaster
- potvrda: tačan naziv organizacije + OBRISI
- briše organizations red i oslanja se na postojeće FK CASCADE/SET NULL veze
- čisti documents, receipt-images i organization-assets storage prefikse
- briše owner/employee Auth naloge samo kada više nisu član/vlasnik druge organizacije i nisu master_admin
- ne briše spoljne ACCOUNTANT članove klijentske firme
- kod brisanja knjigovođe klijentske firme ostaju sačuvane; brišu se veze
- audit organization_deleted ostaje u master_action_log sa ID/nazivom/PIB-om u details JSON
- APR companies registar se ne briše
- nema novog SQL-a; poslednja migracija ostaje SQL_032
- statička sintaksna provera: 188 TS/TSX fajlova, 0 grešaka
