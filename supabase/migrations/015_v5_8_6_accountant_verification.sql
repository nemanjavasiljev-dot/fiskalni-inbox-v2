-- FiscalBox V5.8.6 - verifikacija knjigovođe email linkom
-- Bezbedan, jednokratan token za prihvatanje novog klijenta.

alter table public.accountant_invitations
  add column if not exists accountant_organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists token_hash text,
  add column if not exists expires_at timestamptz,
  add column if not exists verification_sent_at timestamptz,
  add column if not exists verified_at timestamptz;

create unique index if not exists idx_accountant_invitations_token_hash
  on public.accountant_invitations(token_hash)
  where token_hash is not null;

create index if not exists idx_accountant_invitations_recipient_pending
  on public.accountant_invitations(accountant_pib,email,status,created_at desc);

create index if not exists idx_accountant_invitations_expires
  on public.accountant_invitations(expires_at)
  where status='pending';
