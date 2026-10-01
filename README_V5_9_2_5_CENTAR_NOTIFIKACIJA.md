# FiscalBox V5.9.2.5 — Centar notifikacija

Dodato:
- zajednička rubrika **Notifikacije** za USER/FIRMA i KNJIGOVOĐU;
- čitanje pune poruke i označavanje pročitano/nepročitano;
- soft brisanje notifikacije;
- reakcije: Primljeno, Važno, Hvala, Završeno;
- dugme za otvaranje povezane stavke ako notifikacija sadrži URL;
- responsive prikaz za desktop i mobilni;
- KNJIGO meni i mobilno zvono sada vode u Centar notifikacija;
- USER → Više sada ima stavku Notifikacije.

## SQL
Pre deploy-a pokrenuti:
`SQL_027_CENTAR_NOTIFIKACIJA.sql`

Brisanje je soft-delete (`deleted_at`) da se sačuva audit trag.
