-- V4.6 MASTER ADMIN: service controls, accountant privileges, communications, payouts and rewards

alter table public.organizations
  add column if not exists service_block_reason text,
  add column if not exists service_blocked_at timestamptz;

alter table public.organization_members
  add column if not exists accounting_access_role text not null default 'user';

alter table public.organization_members drop constraint if exists organization_members_accounting_access_role_check;
alter table public.organization_members add constraint organization_members_accounting_access_role_check
  check (accounting_access_role in ('admin','user'));

update public.organization_members m
set accounting_access_role='admin'
from public.organizations o
where o.id=m.organization_id and o.organization_type='accounting' and o.owner_user_id=m.user_id;

create or replace function public.is_accounting_office_admin(office uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id=m.organization_id
    where m.organization_id=office
      and m.user_id=auth.uid()
      and o.organization_type='accounting'
      and (o.owner_user_id=auth.uid() or m.accounting_access_role='admin')
  ) or public.is_master_admin();
$$;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.master_notification_log (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('push','email')),
  target_kind text not null default 'selected',
  target_organization_ids uuid[] not null default '{}'::uuid[],
  subject text,
  body text not null,
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.accountant_payouts (
  id uuid primary key default gen_random_uuid(),
  accountant_user_id uuid not null references auth.users(id) on delete cascade,
  accounting_organization_id uuid references public.organizations(id) on delete set null,
  period_month date not null,
  app_users_count integer not null default 0,
  base_amount numeric(14,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  due_at date not null,
  paid_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(accountant_user_id, period_month)
);

create table if not exists public.accountant_rewards (
  id uuid primary key default gen_random_uuid(),
  accountant_user_id uuid not null references auth.users(id) on delete cascade,
  accounting_organization_id uuid references public.organizations(id) on delete set null,
  period_month date not null,
  amount numeric(14,2) not null check (amount > 0),
  reason text not null,
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  paid_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.master_action_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  organization_id uuid references public.organizations(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);
create index if not exists idx_master_notification_log_created on public.master_notification_log(created_at desc);
create index if not exists idx_accountant_payouts_period on public.accountant_payouts(period_month desc, status);
create index if not exists idx_accountant_rewards_period on public.accountant_rewards(period_month desc, status);
create index if not exists idx_master_action_log_created on public.master_action_log(created_at desc);

alter table public.push_subscriptions enable row level security;
alter table public.master_notification_log enable row level security;
alter table public.accountant_payouts enable row level security;
alter table public.accountant_rewards enable row level security;
alter table public.master_action_log enable row level security;

drop policy if exists "user manages own push subscriptions" on public.push_subscriptions;
create policy "user manages own push subscriptions" on public.push_subscriptions for all
using (user_id=auth.uid() or public.is_master_admin())
with check (user_id=auth.uid() or public.is_master_admin());

drop policy if exists "master manages notification log" on public.master_notification_log;
create policy "master manages notification log" on public.master_notification_log for all
using (public.is_master_admin()) with check (public.is_master_admin());

drop policy if exists "master manages accountant payouts" on public.accountant_payouts;
create policy "master manages accountant payouts" on public.accountant_payouts for all
using (public.is_master_admin()) with check (public.is_master_admin());

drop policy if exists "accountant views own payouts" on public.accountant_payouts;
create policy "accountant views own payouts" on public.accountant_payouts for select
using (accountant_user_id=auth.uid());

drop policy if exists "master manages accountant rewards" on public.accountant_rewards;
create policy "master manages accountant rewards" on public.accountant_rewards for all
using (public.is_master_admin()) with check (public.is_master_admin());

drop policy if exists "accountant views own rewards" on public.accountant_rewards;
create policy "accountant views own rewards" on public.accountant_rewards for select
using (accountant_user_id=auth.uid());

drop policy if exists "master manages action log" on public.master_action_log;
create policy "master manages action log" on public.master_action_log for all
using (public.is_master_admin()) with check (public.is_master_admin());

-- Service blocking is enforced at the RLS helper level, not only in the UI.
create or replace function public.is_org_member(org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_master_admin() or (
    exists (
      select 1 from public.organization_members m
      join public.organizations o on o.id=m.organization_id
      where m.organization_id=org and m.user_id=auth.uid() and o.status <> 'paused'
    )
    and not exists (
      select 1 from public.organization_members am
      join public.organizations ao on ao.id=am.organization_id
      where am.user_id=auth.uid()
        and am.role in ('owner','employee')
        and ao.organization_type='accounting'
        and ao.status='paused'
    )
  );
$$;

create or replace function public.is_accounting_office_member(office uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id=m.organization_id
    where m.organization_id=office
      and m.user_id=auth.uid()
      and m.role in ('owner','employee')
      and o.organization_type='accounting'
      and o.status <> 'paused'
  ) or public.is_master_admin();
$$;
