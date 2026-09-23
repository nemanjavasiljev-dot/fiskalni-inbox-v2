-- FiscalBox V5.8.8 - jednostavni zahtevi USER <-> knjigovođa
-- Poziv se šalje samo na email ILI SMS. Prihvatanje se radi u FiscalBox dashboardu.

create table if not exists public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  sender_organization_id uuid not null references public.organizations(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_kind text not null check (sender_kind in ('company','accounting')),
  target_kind text not null check (target_kind in ('company','accounting')),
  target_organization_id uuid references public.organizations(id) on delete set null,
  channel text not null check (channel in ('email','sms')),
  recipient_email text,
  recipient_phone text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled','expired')),
  sent_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  responded_at timestamptz,
  responded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connection_requests_contact_check check (
    (channel='email' and recipient_email is not null and recipient_phone is null)
    or
    (channel='sms' and recipient_phone is not null and recipient_email is null)
  )
);

create index if not exists idx_connection_requests_target_pending
  on public.connection_requests(target_kind,status,created_at desc);

create index if not exists idx_connection_requests_target_org
  on public.connection_requests(target_organization_id,status,created_at desc)
  where target_organization_id is not null;

create index if not exists idx_connection_requests_email
  on public.connection_requests(lower(recipient_email),status,created_at desc)
  where recipient_email is not null;

create index if not exists idx_connection_requests_phone
  on public.connection_requests(recipient_phone,status,created_at desc)
  where recipient_phone is not null;

create index if not exists idx_connection_requests_sender
  on public.connection_requests(sender_organization_id,status,created_at desc);

alter table public.connection_requests enable row level security;

-- Aplikacija ove zahteve čita i obrađuje server-side preko service role ključa.
-- Pošiljalac može da vidi sopstvene zahteve ako zatreba u UI-ju.
drop policy if exists "sender views own connection requests" on public.connection_requests;
create policy "sender views own connection requests" on public.connection_requests for select
using (public.is_org_member(sender_organization_id) or public.is_master_admin());

-- Nema direktnog client-side INSERT/UPDATE. API rute rade proveru identiteta i kontakta.
