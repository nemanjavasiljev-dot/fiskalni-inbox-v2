-- V4.5: FiscalBox billing archive, proforma PDFs and payment status

create table if not exists public.billing_issuer_settings (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  pib text,
  registration_number text,
  address text,
  email text,
  bank_account text,
  vat_rate numeric(5,2) not null default 20,
  is_demo boolean not null default true,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.billing_issuer_settings(company_name,pib,registration_number,address,email,vat_rate,is_demo,active,note)
select 'FiscalBox Demo','000000000','00000000','Demo izdavalac','billing@fiscalbox.local',20,true,true,'DEMO izdavalac - zameniti produkcionim podacima pre komercijalnog pustanja.'
where not exists (select 1 from public.billing_issuer_settings);

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_number text not null unique,
  document_type text not null default 'proforma' check (document_type in ('proforma','invoice')),
  plan text not null check (plan in ('basic','premium')),
  quantity integer not null default 1 check (quantity > 0),
  unit_price_net numeric(14,2) not null,
  subtotal_net numeric(14,2) not null,
  vat_rate numeric(5,2) not null default 20,
  vat_amount numeric(14,2) not null,
  total_amount numeric(14,2) not null,
  currency text not null default 'RSD',
  status text not null default 'unpaid' check (status in ('unpaid','paid','cancelled')),
  issued_at timestamptz not null default now(),
  due_at date,
  paid_at timestamptz,
  emailed_at timestamptz,
  recipient_name text not null,
  recipient_pib text,
  recipient_address text,
  recipient_email text,
  issuer_snapshot jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_billing_invoices_org_date on public.billing_invoices(organization_id, issued_at desc);
create index if not exists idx_billing_invoices_org_status on public.billing_invoices(organization_id, status, issued_at desc);

create or replace function public.can_view_own_billing(org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_master_admin() or exists (
    select 1 from public.organization_members m
    where m.organization_id=org
      and m.user_id=auth.uid()
      and m.role in ('owner','employee')
  );
$$;

alter table public.billing_invoices enable row level security;
alter table public.billing_issuer_settings enable row level security;

drop policy if exists "owners and employees view billing" on public.billing_invoices;
create policy "owners and employees view billing" on public.billing_invoices for select
using (public.can_view_own_billing(organization_id));

drop policy if exists "master manages billing" on public.billing_invoices;
create policy "master manages billing" on public.billing_invoices for all
using (public.is_master_admin()) with check (public.is_master_admin());

drop policy if exists "master views issuer settings" on public.billing_issuer_settings;
create policy "master views issuer settings" on public.billing_issuer_settings for select
using (public.is_master_admin());
