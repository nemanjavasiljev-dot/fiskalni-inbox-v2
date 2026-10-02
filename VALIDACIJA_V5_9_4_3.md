# Validacija FiscalBox V5.9.4.3

- package.json verzija: 5.9.4.3
- TS/TSX sintaksna provera: 188 fajlova, 0 sintaksnih grešaka
- `app/api/documents/send`: nema više slanja push/notifikacije knjigovođi
- `app/api/receipts/send-to-accountant`: nema više slanja push/notifikacije knjigovođi
- `app/api/accountant/notifications`: ne generiše stavke/badge za nove račune i dokumente
- KNJIGO dashboard: brojači Novi računi/Novi dokumenti ostaju aktivni
- Podešavanja KNJIGOVOĐA: uklonjene receipt/document notification opcije; rokovi ostaju
- Nema nove SQL migracije; poslednja ostaje SQL_032
