-- FiscalBox V5.9.1 MERGE
-- Predračun -> bankarska verifikacija -> finalni račun + bank reconciliation + ALSET CO bez PDV-a

begin;

-- 1) Produkcioni izdavalac: OSKAR ZOMBORI PR ALSET CO. (nije u sistemu PDV-a)
alter table public.billing_issuer_settings
  add column if not exists payment_code text not null default '221',
  add column if not exists not_in_vat boolean not null default false;

insert into public.billing_issuer_settings(
  company_name,pib,registration_number,address,email,bank_account,vat_rate,is_demo,active,note,payment_code,not_in_vat
)
select
  'OSKAR ZOMBORI PR ALSET CO.','115266735','68230403',
  'Sterijina 29, sprat 2, stan 13, 24000 Subotica, Srbija',
  'noreply@fiscalbox.rs',null,0,false,true,
  'Izdavalac nije u sistemu PDV-a. PDV nije obračunat u skladu sa članom 33 Zakona o PDV.',
  '221',true
where not exists (
  select 1 from public.billing_issuer_settings where pib='115266735'
);

update public.billing_issuer_settings
set active=false, updated_at=now()
where pib<>'115266735' and active=true;

update public.billing_issuer_settings
set company_name='OSKAR ZOMBORI PR ALSET CO.',
    registration_number='68230403',
    address='Sterijina 29, sprat 2, stan 13, 24000 Subotica, Srbija',
    email=coalesce(nullif(email,''),'noreply@fiscalbox.rs'),
    vat_rate=0,
    is_demo=false,
    active=true,
    not_in_vat=true,
    payment_code=coalesce(nullif(payment_code,''),'221'),
    note='Izdavalac nije u sistemu PDV-a. PDV nije obračunat u skladu sa članom 33 Zakona o PDV.',
    updated_at=now()
where pib='115266735';

-- 2) Dokumenti naplate
alter table public.billing_invoices
  add column if not exists recipient_registration_number text,
  add column if not exists payment_reference text,
  add column if not exists source_proforma_id uuid references public.billing_invoices(id) on delete set null,
  add column if not exists bank_transaction_id uuid,
  add column if not exists verification_source text,
  add column if not exists verified_at timestamptz,
  add column if not exists service_period_start date,
  add column if not exists service_period_end date;

alter table public.billing_invoices drop constraint if exists billing_invoices_status_check;
alter table public.billing_invoices add constraint billing_invoices_status_check
  check (status in ('unpaid','paid','converted','cancelled','refunded','partial_refund'));

create index if not exists idx_billing_payment_reference on public.billing_invoices(payment_reference);
create index if not exists idx_billing_source_proforma on public.billing_invoices(source_proforma_id);

-- 3) Sekvencijalno numerisanje dokumenata
create table if not exists public.billing_document_sequences (
  year integer not null,
  document_type text not null check (document_type in ('proforma','invoice')),
  last_number integer not null default 0,
  primary key(year,document_type)
);

create or replace function public.next_billing_document_number(p_document_type text)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  y integer := extract(year from now())::integer;
  n integer;
  prefix text;
begin
  if p_document_type not in ('proforma','invoice') then
    raise exception 'Unsupported billing document type';
  end if;
  insert into public.billing_document_sequences(year,document_type,last_number)
  values(y,p_document_type,1)
  on conflict(year,document_type)
  do update set last_number=public.billing_document_sequences.last_number+1
  returning last_number into n;
  prefix := case when p_document_type='proforma' then 'PF' else 'R' end;
  return prefix || '-' || y::text || '-' || lpad(n::text,6,'0');
end;
$$;

revoke all on function public.next_billing_document_number(text) from public;
grant execute on function public.next_billing_document_number(text) to service_role;

-- 4) Bankarske transakcije i rasknjižavanje
create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'bank_api',
  external_id text not null unique,
  direction text not null default 'credit' check (direction in ('credit','debit')),
  amount numeric(14,2) not null,
  currency text not null default 'RSD',
  payer_name text,
  payer_account text,
  account_number text,
  payment_reference text,
  description text,
  booked_at timestamptz,
  status text not null default 'unmatched' check (status in ('unmatched','matched','ignored')),
  matched_invoice_id uuid references public.billing_invoices(id) on delete set null,
  matched_organization_id uuid references public.organizations(id) on delete set null,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bank_transactions_status_date on public.bank_transactions(status,booked_at desc);
create index if not exists idx_bank_transactions_reference on public.bank_transactions(payment_reference);
create index if not exists idx_bank_transactions_amount on public.bank_transactions(amount,currency);

alter table public.billing_invoices
  drop constraint if exists billing_invoices_bank_transaction_id_fkey;
alter table public.billing_invoices
  add constraint billing_invoices_bank_transaction_id_fkey
  foreign key(bank_transaction_id) references public.bank_transactions(id) on delete set null;

alter table public.bank_transactions enable row level security;
drop policy if exists "master manages bank transactions" on public.bank_transactions;
create policy "master manages bank transactions" on public.bank_transactions for all
using (public.is_master_admin()) with check (public.is_master_admin());

-- 5) Bank-transfer pretplata mora da ima pristup dok traje plaćeni period.
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
        or (
          s.provider='bank_transfer'
          and s.status='active'
          and coalesce(s.current_period_end,s.renews_at) is not null
          and coalesce(s.current_period_end,s.renews_at) > now()
        )
      )
  );
$$;

commit;
