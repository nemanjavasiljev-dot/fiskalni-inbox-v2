# Fiskalni Inbox V2 — Vercel + Supabase

Production-oriented rebuild of Fiskalni Inbox.

## Included

- Public landing page before login
- Pricing:
  - Basic: 1,250 RSD / user / month
  - Premium: 2,000 RSD / user / month
- Username + password login for real users
- Google OAuth registration/login
- Public demo accounts:
  - `user / user`
  - `knjigo / knjigo`
  - `master / master`
- Demo data is client-side and isolated from production
- Company / accountant / master-admin roles
- Multi-tenant organizations
- QR scanner with `jsQR`
- Official-domain allowlist for Serbian fiscal verification links
- Receipt database, CSV export, print/save-as-PDF view
- Subscription data model
- Row Level Security (RLS)

## 1. Create Supabase project

Create a Supabase project and open SQL Editor.

Run:

`supabase/migrations/001_init.sql`

Then enable Google under Authentication > Providers > Google and configure your Google OAuth credentials.

Important Google OAuth setup:

- In Google Cloud, set the **Authorized redirect URI** to the Supabase callback URL shown on the Supabase Google provider page (it looks like `https://PROJECT_REF.supabase.co/auth/v1/callback`).
- In Supabase Authentication > URL Configuration, set the production **Site URL** to your Vercel/custom-domain URL and add `https://YOUR_DOMAIN/auth/callback` to **Redirect URLs**.
- For local development, also add `http://localhost:3000/auth/callback` to Supabase Redirect URLs.

## 2. Environment variables

Copy `.env.example` to `.env.local`.

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

IMPORTANT: The Supabase secret key is server-only. Never prefix it with `NEXT_PUBLIC_` and never commit it to GitHub.

## 3. Run locally

```bash
npm install
npm run dev
```

## 4. Deploy to Vercel

Push this repository to GitHub and import it in Vercel.

Add the same environment variables in Vercel Project Settings > Environment Variables.

Deploy.

## 5. Create production users

A real user registers through Google. Supabase creates a row in `profiles` automatically.

The generated username is based on the email local-part plus a short unique suffix. You can later add a profile/settings page for username changes.

For password accounts, create the user in Supabase Auth with email + password; the trigger creates their profile/username. They then sign in using their username. The API resolves username to auth email server-side and Supabase performs password verification.

## 6. Master admin

Register the real admin user, then run `supabase/MASTER_ADMIN.sql` after replacing the email.

Never connect the public `master / master` demo account to production data.

## Security model

- Demo credentials use only static demo data.
- Production data requires Supabase Auth.
- Organization and receipt data is protected with RLS.
- Username-to-email resolution runs server-side with the service-role key.
- Password verification is performed by Supabase Auth, not by custom plaintext storage.
- Fiscal QR fetch accepts HTTPS only and only official Poreska uprava hostnames from the allowlist.

## Next production steps

1. Test against several real Serbian fiscal QR codes and adjust the JSON normalizer to the exact production response shape.
2. Add payment provider / recurring billing.
3. Add accountant invitation email flow.
4. Add receipt image/PDF archival if legally/business-required.
5. Add audit log and deletion/archive retention rules.
Vercel deploy trigger
