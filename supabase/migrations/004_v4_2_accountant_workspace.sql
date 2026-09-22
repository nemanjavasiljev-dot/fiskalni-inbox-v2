create table if not exists public.accountant_receipt_status (
  accountant_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  opened_at timestamptz,
  downloaded_at timestamptz,
  printed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (accountant_user_id, receipt_id)
);

create table if not exists public.accountant_document_status (
  accountant_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  opened_at timestamptz,
  downloaded_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (accountant_user_id, document_id)
);

create index if not exists idx_accountant_receipt_status_org on public.accountant_receipt_status(accountant_user_id, organization_id, updated_at desc);
create index if not exists idx_accountant_document_status_org on public.accountant_document_status(accountant_user_id, organization_id, updated_at desc);

create or replace function public.is_accountant_for_org(org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org
      and m.user_id = auth.uid()
      and m.role = 'accountant'
  );
$$;

alter table public.accountant_receipt_status enable row level security;
alter table public.accountant_document_status enable row level security;

drop policy if exists "accountant receipt status select" on public.accountant_receipt_status;
create policy "accountant receipt status select" on public.accountant_receipt_status for select
using ((accountant_user_id = auth.uid() and public.is_accountant_for_org(organization_id)) or public.is_master_admin());

drop policy if exists "accountant receipt status insert" on public.accountant_receipt_status;
create policy "accountant receipt status insert" on public.accountant_receipt_status for insert
with check (accountant_user_id = auth.uid() and public.is_accountant_for_org(organization_id));

drop policy if exists "accountant receipt status update" on public.accountant_receipt_status;
create policy "accountant receipt status update" on public.accountant_receipt_status for update
using (accountant_user_id = auth.uid() and public.is_accountant_for_org(organization_id))
with check (accountant_user_id = auth.uid() and public.is_accountant_for_org(organization_id));

drop policy if exists "accountant document status select" on public.accountant_document_status;
create policy "accountant document status select" on public.accountant_document_status for select
using ((accountant_user_id = auth.uid() and public.is_accountant_for_org(organization_id)) or public.is_master_admin());

drop policy if exists "accountant document status insert" on public.accountant_document_status;
create policy "accountant document status insert" on public.accountant_document_status for insert
with check (accountant_user_id = auth.uid() and public.is_accountant_for_org(organization_id));

drop policy if exists "accountant document status update" on public.accountant_document_status;
create policy "accountant document status update" on public.accountant_document_status for update
using (accountant_user_id = auth.uid() and public.is_accountant_for_org(organization_id))
with check (accountant_user_id = auth.uid() and public.is_accountant_for_org(organization_id));
