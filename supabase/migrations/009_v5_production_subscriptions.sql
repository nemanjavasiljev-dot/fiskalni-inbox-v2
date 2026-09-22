-- FiscalBox V5: production subscriptions, real billing provider sync and service access enforcement

-- Convert legacy standalone trial plan rows to a real target plan.
update public.organizations set plan='basic' where plan='trial';
update public.subscriptions set plan='basic' where plan='trial';

alter table public.organizations drop constraint if exists organizations_plan_check;
alter table public.organizations add constraint organizations_plan_check check (plan in ('basic','premium'));

alter table public.organizations drop constraint if exists organizations_status_check;
alter table public.organizations add constraint organizations_status_check
  check (status in ('trial','active','pending_payment','paused','cancelled'));

alter table public.subscriptions
  add column if not exists provider text,
  add column if not exists provider_customer_id text,
  add column if not exists provider_subscription_id text,
  add column if not exists provider_variant_id text,
  add column if not exists provider_checkout_id text,
  add column if not exists provider_status text,
  add column if not exists provider_test_mode boolean not null default false,
  add column if not exists trial_used_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists last_payment_at timestamptz,
  add column if not exists renews_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists payment_processor text,
  add column if not exists card_brand text,
  add column if not exists card_last_four text,
  add column if not exists customer_portal_url text,
  add column if not exists update_payment_url text,
  add column if not exists checkout_started_at timestamptz,
  add column if not exists last_webhook_at timestamptz;

alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in ('basic','premium'));

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('trial','pending_checkout','active','paused','past_due','unpaid','cancelled','expired'));

create unique index if not exists idx_subscriptions_provider_subscription
  on public.subscriptions(provider_subscription_id)
  where provider_subscription_id is not null;

create index if not exists idx_subscriptions_status on public.subscriptions(status, trial_ends_at, current_period_end);

-- Existing "active" subscriptions created before the production payment integration were not provider-backed.
-- They must complete a real checkout before commercial access continues.
update public.subscriptions
set status='pending_checkout'
where status='active' and provider_subscription_id is null;

update public.organizations o
set status='pending_payment'
where o.status='active'
  and exists (
    select 1 from public.subscriptions s
    where s.organization_id=o.id and s.status='pending_checkout'
  );

-- Legacy trial rows remain valid until their original 10-day deadline, now as a BASIC trial.
update public.subscriptions
set trial_used_at=coalesce(trial_used_at, trial_started_at, created_at)
where status='trial' and trial_used_at is null;

-- Provider invoice metadata for real recurring payments.
alter table public.billing_invoices
  add column if not exists provider text,
  add column if not exists provider_invoice_id text,
  add column if not exists external_invoice_url text,
  add column if not exists provider_status text,
  add column if not exists billing_reason text,
  add column if not exists payment_processor text,
  add column if not exists card_brand text,
  add column if not exists card_last_four text;

alter table public.billing_invoices drop constraint if exists billing_invoices_status_check;
alter table public.billing_invoices add constraint billing_invoices_status_check
  check (status in ('unpaid','paid','cancelled','refunded','partial_refund'));

drop index if exists idx_billing_provider_invoice;
create unique index if not exists idx_billing_provider_invoice_id
  on public.billing_invoices(provider_invoice_id);

-- Disable the seeded demo issuer. Manual master invoices now require real issuer data.
update public.billing_issuer_settings
set active=false
where is_demo=true;

-- Idempotent webhook audit.
create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_hash text not null unique,
  event_name text not null,
  object_id text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);

create index if not exists idx_billing_webhook_events_created on public.billing_webhook_events(processed_at desc);
alter table public.billing_webhook_events enable row level security;

drop policy if exists "master views billing webhook events" on public.billing_webhook_events;
create policy "master views billing webhook events" on public.billing_webhook_events for select
using (public.is_master_admin());

-- Raw membership helper is intentionally independent from billing. It is used only for account metadata,
-- subscription management and showing the user how to reactivate service.
create or replace function public.is_org_member_raw(org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id=org and m.user_id=auth.uid()
  ) or public.is_master_admin();
$$;

create or replace function public.organization_service_available(org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_master_admin() or exists (
    select 1
    from public.organizations o
    join public.subscriptions s on s.organization_id=o.id
    where o.id=org
      and o.status not in ('paused','cancelled','pending_payment')
      and (
        (s.status='trial' and s.trial_ends_at is not null and s.trial_ends_at > now())
        or (
          s.provider='lemonsqueezy'
          and s.provider_subscription_id is not null
          and (
            s.status in ('active','paused','past_due')
            or (s.status='cancelled' and coalesce(s.ends_at,s.current_period_end) > now())
          )
        )
      )
  );
$$;

-- Service-aware membership used by receipts/documents/etc.
create or replace function public.is_org_member(org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_master_admin() or (
    public.is_org_member_raw(org)
    and public.organization_service_available(org)
    and not exists (
      select 1
      from public.organization_members am
      join public.organizations ao on ao.id=am.organization_id
      where am.user_id=auth.uid()
        and am.role in ('owner','employee')
        and ao.organization_type='accounting'
        and not public.organization_service_available(ao.id)
    )
  );
$$;

create or replace function public.is_accounting_office_member(office uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_master_admin() or (
    public.is_org_member_raw(office)
    and public.organization_service_available(office)
    and exists (
      select 1 from public.organizations o
      where o.id=office and o.organization_type='accounting'
    )
  );
$$;

-- Allow logged-in users to read their own account/org/subscription metadata even if a trial expired,
-- while service data remains protected by is_org_member().
drop policy if exists "organizations member select" on public.organizations;
drop policy if exists "organizations raw member select" on public.organizations;
create policy "organizations raw member select" on public.organizations for select
using (owner_user_id=auth.uid() or public.is_org_member_raw(id));

drop policy if exists "members visible to org" on public.organization_members;
drop policy if exists "members visible to raw org member" on public.organization_members;
create policy "members visible to raw org member" on public.organization_members for select
using (user_id=auth.uid() or public.is_org_member_raw(organization_id));

drop policy if exists "subscriptions member select" on public.subscriptions;
drop policy if exists "subscriptions raw member select" on public.subscriptions;
create policy "subscriptions raw member select" on public.subscriptions for select
using (public.is_org_member_raw(organization_id));

-- Trial rows that have already expired are marked as pending payment for clearer UI.
update public.organizations o
set status='pending_payment'
where o.status='trial'
  and exists (
    select 1 from public.subscriptions s
    where s.organization_id=o.id and s.status='trial' and s.trial_ends_at <= now()
  );
