alter table public.organizations
  add column if not exists registration_number text,
  add column if not exists legal_form text,
  add column if not exists address text,
  add column if not exists municipality text,
  add column if not exists activity_code text,
  add column if not exists activity_name text,
  add column if not exists apr_raw jsonb;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null default 0,
  source text not null default 'upload' check (source in ('upload','camera','scan')),
  status text not null default 'inbox' check (status in ('inbox','sent')),
  sent_at timestamptz,
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_documents_org_created on public.documents(organization_id, created_at desc);
create index if not exists idx_documents_org_status on public.documents(organization_id, status, created_at desc);

create or replace function public.can_manage_org_documents(org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_master_admin() or exists (
    select 1 from public.organization_members m
    where m.organization_id = org
      and m.user_id = auth.uid()
      and m.role in ('owner','employee')
  );
$$;

create or replace function public.can_view_org_document(org uuid, doc_status text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_master_admin() or exists (
    select 1 from public.organization_members m
    where m.organization_id = org
      and m.user_id = auth.uid()
      and (
        m.role in ('owner','employee')
        or (m.role = 'accountant' and doc_status = 'sent')
      )
  );
$$;

alter table public.documents enable row level security;

drop policy if exists "documents visible by role" on public.documents;
create policy "documents visible by role" on public.documents for select
using (public.can_view_org_document(organization_id, status));

drop policy if exists "company can insert documents" on public.documents;
create policy "company can insert documents" on public.documents for insert
with check (public.can_manage_org_documents(organization_id) and uploaded_by = auth.uid());

drop policy if exists "company can update documents" on public.documents;
create policy "company can update documents" on public.documents for update
using (public.can_manage_org_documents(organization_id))
with check (public.can_manage_org_documents(organization_id));

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = 20971520;
