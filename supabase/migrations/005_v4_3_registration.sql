-- V4.3: public registration, account type, 10-day trial and accountant linking

alter table public.organizations
  add column if not exists organization_type text not null default 'company',
  add column if not exists trial_ends_at timestamptz,
  add column if not exists accountant_pib_pending text,
  add column if not exists accountant_contact_email text;

alter table public.organizations drop constraint if exists organizations_organization_type_check;
alter table public.organizations add constraint organizations_organization_type_check
  check (organization_type in ('company','accounting'));

alter table public.organizations drop constraint if exists organizations_plan_check;
alter table public.organizations add constraint organizations_plan_check
  check (plan in ('trial','basic','premium'));

alter table public.subscriptions
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz;

alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check
  check (plan in ('trial','basic','premium'));

create table if not exists public.accountant_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  accountant_pib text,
  email text,
  status text not null default 'pending' check (status in ('pending','accepted','cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists idx_accountant_invitations_org on public.accountant_invitations(organization_id, status, created_at desc);
create index if not exists idx_accountant_invitations_pib on public.accountant_invitations(accountant_pib) where accountant_pib is not null;
create index if not exists idx_accounting_org_pib on public.organizations(pib) where organization_type='accounting' and pib is not null;

-- Existing organizations owned by an accountant are marked as accounting offices.
update public.organizations o
set organization_type='accounting'
where exists (
  select 1 from public.profiles p
  where p.user_id=o.owner_user_id and p.global_role='accountant'
);

alter table public.accountant_invitations enable row level security;

drop policy if exists "owner can view accountant invitations" on public.accountant_invitations;
create policy "owner can view accountant invitations" on public.accountant_invitations for select
using (public.is_org_owner(organization_id) or public.is_master_admin());

drop policy if exists "owner can create accountant invitations" on public.accountant_invitations;
create policy "owner can create accountant invitations" on public.accountant_invitations for insert
with check (public.is_org_owner(organization_id) or public.is_master_admin());

drop policy if exists "owner can update accountant invitations" on public.accountant_invitations;
create policy "owner can update accountant invitations" on public.accountant_invitations for update
using (public.is_org_owner(organization_id) or public.is_master_admin())
with check (public.is_org_owner(organization_id) or public.is_master_admin());
