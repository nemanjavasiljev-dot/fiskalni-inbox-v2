alter table public.organizations
  add column if not exists logo_path text,
  add column if not exists receipt_send_schedule text not null default 'manual',
  add column if not exists last_auto_receipt_send_at timestamptz;

alter table public.organizations drop constraint if exists organizations_receipt_send_schedule_check;
alter table public.organizations
  add constraint organizations_receipt_send_schedule_check
  check (receipt_send_schedule in ('manual','weekly','monthly'));

alter table public.receipts
  add column if not exists category_source text not null default 'manual',
  add column if not exists category_confidence numeric(5,4),
  add column if not exists sent_to_accountant_at timestamptz,
  add column if not exists sent_by uuid references auth.users(id) on delete set null;

update public.receipts
set category = 'Ostalo'
where category is null or category = '' or category = 'Nekategorizovano';

create index if not exists idx_receipts_org_sent on public.receipts(organization_id, sent_to_accountant_at, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit)
values ('organization-assets', 'organization-assets', false, 5242880)
on conflict (id) do update set public = false, file_size_limit = 5242880;

create or replace function public.can_view_org_receipt(org uuid, sent_at timestamptz)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_master_admin() or exists (
    select 1 from public.organization_members m
    where m.organization_id = org
      and m.user_id = auth.uid()
      and (
        m.role in ('owner','employee')
        or (m.role = 'accountant' and sent_at is not null)
      )
  );
$$;

drop policy if exists "receipt member select" on public.receipts;
drop policy if exists "receipt visible by role" on public.receipts;
create policy "receipt visible by role" on public.receipts for select
using (public.can_view_org_receipt(organization_id, sent_to_accountant_at));
