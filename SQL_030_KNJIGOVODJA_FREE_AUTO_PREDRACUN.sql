-- FiscalBox V5.9.3.5
-- Knjigovodja bez pretplate + izbor paketa za klijenta + automatski mesecni predracuni

begin;

-- Paket koji knjigovodja bira kada poziva/dodaje klijenta.
alter table public.connection_requests
  add column if not exists requested_plan text;

update public.connection_requests
set requested_plan='basic'
where requested_plan is null and sender_kind='accounting' and target_kind='company';

alter table public.connection_requests
  drop constraint if exists connection_requests_requested_plan_check;
alter table public.connection_requests
  add constraint connection_requests_requested_plan_check
  check (requested_plan is null or requested_plan in ('basic','premium'));

alter table public.client_invitations
  add column if not exists requested_plan text;

update public.client_invitations
set requested_plan='basic'
where requested_plan is null;

alter table public.client_invitations
  drop constraint if exists client_invitations_requested_plan_check;
alter table public.client_invitations
  add constraint client_invitations_requested_plan_check
  check (requested_plan is null or requested_plan in ('basic','premium'));


-- Knjigovodstvene organizacije su besplatne i njihov pristup ne zavisi od subscriptions tabele.
update public.organizations
set status='active', trial_ends_at=null
where organization_type='accounting'
  and service_blocked_at is null
  and status not in ('active','paused');

create or replace function public.organization_service_available(org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_master_admin() or exists (
    select 1
    from public.organizations o
    where o.id=org
      and o.status not in ('paused','cancelled')
      and (
        o.organization_type='accounting'
        or exists (
          select 1
          from public.subscriptions s
          where s.organization_id=o.id
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
              or (
                s.provider='bank_transfer'
                and s.status='active'
                and coalesce(s.current_period_end,s.renews_at) is not null
                and coalesce(s.current_period_end,s.renews_at) > now()
              )
            )
        )
      )
  );
$$;

-- Automatsko izdavanje novog predracuna na mesecnu godisnjicu prve uplate.
alter table public.subscriptions
  add column if not exists auto_proforma_enabled boolean not null default true,
  add column if not exists first_paid_at timestamptz,
  add column if not exists billing_anchor_day smallint,
  add column if not exists next_proforma_at date,
  add column if not exists last_auto_proforma_at timestamptz,
  add column if not exists last_auto_proforma_id uuid;

alter table public.subscriptions
  drop constraint if exists subscriptions_billing_anchor_day_check;
alter table public.subscriptions
  add constraint subscriptions_billing_anchor_day_check
  check (billing_anchor_day is null or billing_anchor_day between 1 and 31);

alter table public.subscriptions
  drop constraint if exists subscriptions_last_auto_proforma_id_fkey;
alter table public.subscriptions
  add constraint subscriptions_last_auto_proforma_id_fkey
  foreign key(last_auto_proforma_id) references public.billing_invoices(id) on delete set null;

-- Jedan automatski ciklus = najvise jedan predracun po organizaciji.
alter table public.billing_invoices
  add column if not exists billing_cycle_on date;

create unique index if not exists uq_billing_proforma_cycle
  on public.billing_invoices(organization_id,billing_cycle_on)
  where document_type='proforma' and billing_cycle_on is not null;

create index if not exists idx_subscriptions_auto_proforma_due
  on public.subscriptions(auto_proforma_enabled,next_proforma_at)
  where auto_proforma_enabled=true and next_proforma_at is not null;

-- Knjigovodstvene organizacije su besplatne: nema automatskog slanja njihovih predracuna.
update public.subscriptions s
set auto_proforma_enabled=false,
    next_proforma_at=null
from public.organizations o
where o.id=s.organization_id and o.organization_type='accounting';

-- Backfill za vec aktivne bank-transfer klijente: prva poznata uplata + sledeca obnova.
update public.subscriptions s
set first_paid_at=coalesce(s.first_paid_at,s.activated_at,s.last_payment_at),
    billing_anchor_day=coalesce(
      s.billing_anchor_day,
      extract(day from coalesce(s.activated_at,s.last_payment_at))::smallint
    ),
    next_proforma_at=coalesce(
      s.next_proforma_at,
      coalesce(s.current_period_end,s.renews_at)::date
    ),
    auto_proforma_enabled=true
from public.organizations o
where o.id=s.organization_id
  and o.organization_type='company'
  and s.provider='bank_transfer'
  and coalesce(s.activated_at,s.last_payment_at) is not null;

commit;
