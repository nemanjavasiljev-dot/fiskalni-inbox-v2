# FiscalBox V4 — deploy update

V4 is an update for the existing GitHub/Vercel/Supabase project.

## What V4 adds

### USER / Firma
- Bottom menu: Home · Pretraga · QR · Fajlovi · Više
- New `/app/files` workspace
- Scan/photo/upload documents
- Search documents
- Select documents with checkboxes
- Send selected documents to the accountant
- Sent documents move to `Poslati dokumenti`
- Private document storage (Supabase Storage)
- Accountant sees only documents marked as sent
- Responsive desktop/mobile UI

### Company onboarding
- First company setup starts with PIB (9 digits) or Matični broj (8 digits)
- `/api/apr/lookup` adapter is ready for a contracted APR web-service endpoint
- When configured, company fields are automatically mapped into the setup form
- Manual entry remains available as a fallback

### MASTER
- Number of clients
- Number of accountants
- Click `Knjigovođe` to open the accountant list
- Clients per accountant
- App users per accountant
- Accountant fee: 250 RSD × app users / month
- Due date: last calendar day of the current month
- Gross MRR: Basic 1,250 RSD/user; Premium 2,000 RSD/user
- Profit shown as subscriptions minus accountant fees (before other costs)

## IMPORTANT — run database migration first

In Supabase > SQL Editor, run the complete file:

`supabase/migrations/002_v4_documents_apr.sql`

It adds company APR fields, creates the `documents` table, RLS policies and the private `documents` Storage bucket.

## APR API environment variables

APR states that automated access should use a web service. Do not scrape the public search pages.

Add these in Vercel > Environment Variables when APR gives you the contracted API endpoint/access data:

- `APR_API_URL`
- `APR_API_TOKEN` (only if the APR service uses a token)
- `APR_API_TOKEN_HEADER` (default: `Authorization`)
- `APR_API_TOKEN_PREFIX` (default: `Bearer `)

The URL may contain `{query}`, `{pib}` or `{mb}`. If there is no placeholder, the adapter appends `?pib=` or `?mb=`.

Examples only (replace with the actual contracted APR endpoint):

`APR_API_URL=https://APR-ENDPOINT/{query}`

If APR requires an API key header:

`APR_API_TOKEN_HEADER=X-API-Key`
`APR_API_TOKEN_PREFIX=`

Never put API secrets in GitHub.

## Deploy order

1. Run `002_v4_documents_apr.sql` in Supabase SQL Editor.
2. Copy the V4 patch files over the same paths in your local `fiskalni-inbox-v2` repository.
3. GitHub Desktop summary: `FiscalBox V4 files APR master update`
4. Commit to main.
5. Push origin.
6. Wait for Vercel Deployment = Ready.
7. Test `user / user` demo and a real production user.
8. Add APR variables later when you receive APR web-service credentials.

## Security

- Documents are stored in a private Supabase Storage bucket.
- Downloads are delivered through short-lived signed URLs after application/RLS authorization.
- Accountants can see only documents whose status is `sent`.
- Company owner/employee can upload and send documents.
- File size is limited to 20 MB each and 10 files per upload request.
