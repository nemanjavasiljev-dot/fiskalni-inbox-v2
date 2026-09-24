# FiscalBox V5.9.1.1 – Build Fix

Ispravljena TypeScript build greška u `lib/accountant-download-access.ts`.

Problem: TypeScript je `relationIds` inferirao kao `Set<unknown>`, pa `allowed.add(id)` nije mogao da primi `unknown`.

Rešenje: `relationIds` je eksplicitno tipiziran kao `Set<string>` i vrednosti se normalizuju u string pre dodavanja.

Provera:
- pojedinačni TypeScript check za izmenjeni fajl: prolazi
- syntax check svih 150 TS/TSX fajlova: 0 grešaka

Nema novih SQL migracija.
