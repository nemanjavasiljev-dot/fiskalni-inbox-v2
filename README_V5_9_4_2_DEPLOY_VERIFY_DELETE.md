# FiscalBox V5.9.4.2 — deploy verifikacija brisanja

- SUPER ADMIN zaglavlje prikazuje `v5.9.4.2`.
- Crvena kanta je direktno pored `Otvori / edituj` za firme i knjigovođe.
- Klik: potvrda -> PIN -> DELETE API.
- Podrazumevani PIN: `5203` ili `MASTER_DELETE_PIN` iz server env.
- Nema novog SQL-a.

## OBAVEZAN deploy na self-hosted Next.js

```bash
rm -rf .next
npm install
npm run build
pm2 restart fiscalbox --update-env
```

Ako servis ima drugo PM2 ime, koristiti to ime. Ako se koristi systemd: `sudo systemctl restart fiscalbox`.

Nakon deploya otvoriti SUPER ADMIN i proveriti da zaglavlje zaista pokazuje `v5.9.4.2`. Ako ne pokazuje, server i dalje servira stari build.
