create extension if not exists pgcrypto;

do $$ begin
  create type public.global_role as enum ('user','accountant','master_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.member_role as enum ('owner','employee','accountant');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  auth_email text not null,
  username text not null unique,
  full_name text,
  global_role public.global_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pib text,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  plan text not null default 'basic' check (plan in ('basic','premium')),
  status text not null default 'active' check (status in ('trial','active','paused','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  unique(organization_id,user_id)
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  qr_url text not null,
  merchant_name text,
  merchant_pib text,
  invoice_number text,
  sdc_time timestamptz,
  total_amount numeric(14,2),
  total_tax numeric(14,2),
  payment_method text,
  buyer_pib text,
  category text not null default 'Nekategorizovano',
  note text,
  verification_status text not null default 'provera_neuspela',
  raw_json jsonb,
  created_at timestamptz not null default now(),
  unique(organization_id,qr_url)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  plan text not null check(plan in ('basic','premium')),
  seat_count integer not null default 1 check(seat_count > 0),
  status text not null default 'trial' check(status in ('trial','active','past_due','cancelled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.is_master_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.global_role = 'master_admin'
  );
$$;

create or replace function public.is_org_member(org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.user_id = auth.uid()
  ) or public.is_master_admin();
$$;

create or replace function public.is_org_owner(org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organizations o
    where o.id = org and o.owner_user_id = auth.uid()
  ) or public.is_master_admin();
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  base_username text;
  candidate text;
begin
  base_username := lower(regexp_replace(split_part(coalesce(new.email,'user'), '@', 1), '[^a-zA-Z0-9_]+', '_', 'g'));
  if base_username = '' then base_username := 'user'; end if;
  candidate := base_username || '_' || substr(new.id::text,1,6);

  insert into public.profiles(user_id,auth_email,username,full_name)
  values(new.id,coalesce(new.email,''),candidate,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.receipts enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "profiles self or master select" on public.profiles;
create policy "profiles self or master select" on public.profiles for select
using (auth.uid() = user_id or public.is_master_admin());

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "organizations member select" on public.organizations;
create policy "organizations member select" on public.organizations for select
using (owner_user_id = auth.uid() or public.is_org_member(id));

drop policy if exists "organizations owner insert" on public.organizations;
create policy "organizations owner insert" on public.organizations for insert
with check (auth.uid() = owner_user_id);

drop policy if exists "organizations owner update" on public.organizations;
create policy "organizations owner update" on public.organizations for update
using (auth.uid() = owner_user_id or public.is_master_admin());

drop policy if exists "members visible to org" on public.organization_members;
create policy "members visible to org" on public.organization_members for select
using (public.is_org_member(organization_id));

drop policy if exists "owner can add members" on public.organization_members;
create policy "owner can add members" on public.organization_members for insert
with check (public.is_org_owner(organization_id));

drop policy if exists "owner can change members" on public.organization_members;
create policy "owner can change members" on public.organization_members for update
using (public.is_org_owner(organization_id));

drop policy if exists "receipt member select" on public.receipts;
create policy "receipt member select" on public.receipts for select
using (public.is_org_member(organization_id));

drop policy if exists "receipt member insert" on public.receipts;
create policy "receipt member insert" on public.receipts for insert
with check (public.is_org_member(organization_id) and created_by=auth.uid());

drop policy if exists "receipt member update" on public.receipts;
create policy "receipt member update" on public.receipts for update
using (public.is_org_member(organization_id));

drop policy if exists "subscriptions member select" on public.subscriptions;
create policy "subscriptions member select" on public.subscriptions for select
using (public.is_org_member(organization_id));

drop policy if exists "subscriptions owner insert" on public.subscriptions;
create policy "subscriptions owner insert" on public.subscriptions for insert
with check (public.is_org_owner(organization_id));

drop policy if exists "subscriptions owner update" on public.subscriptions;
create policy "subscriptions owner update" on public.subscriptions for update
using (public.is_org_owner(organization_id));

create index if not exists idx_receipts_org_date on public.receipts(organization_id,created_at desc);
create index if not exists idx_members_user on public.organization_members(user_id);
create index if not exists idx_profiles_username on public.profiles(username);
