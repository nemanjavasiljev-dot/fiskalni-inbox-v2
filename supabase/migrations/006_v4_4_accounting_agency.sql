-- V4.4: accounting office CRM, client invitations, employees, assignments and notification settings

alter table public.organizations
  add column if not exists contact_email text,
  add column if not exists contact_phone text;

create table if not exists public.client_invitations (
  id uuid primary key default gen_random_uuid(),
  accounting_organization_id uuid not null references public.organizations(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  assigned_employee_id uuid references auth.users(id) on delete set null,
  company_pib text not null,
  company_registration_number text,
  company_name text not null,
  company_snapshot jsonb,
  email text,
  phone text,
  invite_channel text not null default 'email' check (invite_channel in ('email','sms','both')),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','cancelled','expired')),
  expires_at timestamptz not null default (now() + interval '30 days'),
  sent_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.accountant_client_assignments (
  accounting_organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  client_organization_id uuid not null references public.organizations(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (accounting_organization_id, employee_user_id, client_organization_id)
);

create table if not exists public.accountant_user_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  accounting_organization_id uuid not null references public.organizations(id) on delete cascade,
  notify_new_receipts boolean not null default true,
  notify_new_documents boolean not null default true,
  notify_deadlines boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, accounting_organization_id)
);

create index if not exists idx_client_invitations_office on public.client_invitations(accounting_organization_id, status, created_at desc);
create index if not exists idx_client_invitations_pib on public.client_invitations(company_pib, status);
create index if not exists idx_accountant_assignments_employee on public.accountant_client_assignments(employee_user_id, created_at desc);
create index if not exists idx_accountant_assignments_client on public.accountant_client_assignments(client_organization_id);

create or replace function public.is_accounting_office_member(office uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id=m.organization_id
    where m.organization_id=office
      and m.user_id=auth.uid()
      and m.role in ('owner','employee')
      and o.organization_type='accounting'
  ) or public.is_master_admin();
$$;

create or replace function public.is_accounting_office_admin(office uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.organizations o
    where o.id=office
      and o.organization_type='accounting'
      and o.owner_user_id=auth.uid()
  ) or public.is_master_admin();
$$;

alter table public.client_invitations enable row level security;
alter table public.accountant_client_assignments enable row level security;
alter table public.accountant_user_settings enable row level security;

drop policy if exists "office members view client invitations" on public.client_invitations;
create policy "office members view client invitations" on public.client_invitations for select
using (public.is_accounting_office_member(accounting_organization_id));

drop policy if exists "office members create client invitations" on public.client_invitations;
create policy "office members create client invitations" on public.client_invitations for insert
with check (public.is_accounting_office_member(accounting_organization_id) and invited_by=auth.uid());

drop policy if exists "office members update client invitations" on public.client_invitations;
create policy "office members update client invitations" on public.client_invitations for update
using (public.is_accounting_office_member(accounting_organization_id))
with check (public.is_accounting_office_member(accounting_organization_id));

drop policy if exists "office members view assignments" on public.accountant_client_assignments;
create policy "office members view assignments" on public.accountant_client_assignments for select
using (public.is_accounting_office_member(accounting_organization_id));

drop policy if exists "office admin creates assignments" on public.accountant_client_assignments;
create policy "office admin creates assignments" on public.accountant_client_assignments for insert
with check (public.is_accounting_office_admin(accounting_organization_id));

drop policy if exists "office admin updates assignments" on public.accountant_client_assignments;
create policy "office admin updates assignments" on public.accountant_client_assignments for update
using (public.is_accounting_office_admin(accounting_organization_id))
with check (public.is_accounting_office_admin(accounting_organization_id));

drop policy if exists "office admin deletes assignments" on public.accountant_client_assignments;
create policy "office admin deletes assignments" on public.accountant_client_assignments for delete
using (public.is_accounting_office_admin(accounting_organization_id));

drop policy if exists "accountant settings self select" on public.accountant_user_settings;
create policy "accountant settings self select" on public.accountant_user_settings for select
using (user_id=auth.uid() and public.is_accounting_office_member(accounting_organization_id));

drop policy if exists "accountant settings self insert" on public.accountant_user_settings;
create policy "accountant settings self insert" on public.accountant_user_settings for insert
with check (user_id=auth.uid() and public.is_accounting_office_member(accounting_organization_id));

drop policy if exists "accountant settings self update" on public.accountant_user_settings;
create policy "accountant settings self update" on public.accountant_user_settings for update
using (user_id=auth.uid() and public.is_accounting_office_member(accounting_organization_id))
with check (user_id=auth.uid() and public.is_accounting_office_member(accounting_organization_id));
