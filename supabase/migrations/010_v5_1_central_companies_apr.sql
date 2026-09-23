-- FiscalBox V5.1: central company registry + APR synchronization standard
-- FIXED: avoids schema-dependent unqualified similarity() calls on Supabase.

create extension if not exists pg_trgm;

create or replace function public.normalize_company_name(value text)
returns text
language sql immutable
as $$
  select trim(regexp_replace(lower(coalesce(value,'')), '[^[:alnum:]]+', ' ', 'g'));
$$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  registration_number text,
  pib text,
  address text,
  city text,
  municipality text,
  postal_code text,
  legal_form text,
  activity_code text,
  activity_name text,
  registry_status text,
  founded_at date,
  apr_source_id text,
  apr_last_sync timestamptz,
  apr_raw jsonb,
  source_status text not null default 'apr' check (source_status in ('apr','legacy','manual_review')),
  manual_review_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_companies_registration_number_unique
  on public.companies(registration_number)
  where registration_number is not null and registration_number <> '';
create unique index if not exists idx_companies_pib_unique
  on public.companies(pib)
  where pib is not null and pib <> '';
create index if not exists idx_companies_name_trgm on public.companies using gin(normalized_name gin_trgm_ops);
create index if not exists idx_companies_apr_sync on public.companies(apr_last_sync desc nulls last);

create table if not exists public.company_access_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  requested_role text not null default 'employee' check (requested_role in ('owner','employee')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_company_access_one_pending
  on public.company_access_requests(company_id, requester_user_id) where status='pending';

create table if not exists public.accountant_company (
  id uuid primary key default gen_random_uuid(),
  accountant_organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  client_organization_id uuid references public.organizations(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','active','rejected','blocked')),
  requested_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(accountant_organization_id, company_id)
);

create table if not exists public.apr_sync_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null default 'manual' check (run_type in ('manual','search','detail','scheduled','migration')),
  status text not null default 'running' check (status in ('running','success','partial','failed')),
  requested_by uuid references auth.users(id) on delete set null,
  companies_seen integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  error_count integer not null default 0,
  error_summary text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.company_audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  action text not null,
  field_name text,
  old_value text,
  new_value text,
  source text not null default 'system' check (source in ('system','apr','master','migration')),
  actor_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.company_migration_review (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','resolved','ignored')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(organization_id, reason)
);

create table if not exists public.company_search_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0
);

-- Central company key on legacy/business tables. Keep organization_id for tenant/security compatibility.
alter table public.organizations add column if not exists company_id uuid references public.companies(id) on delete restrict;
alter table public.profiles add column if not exists primary_company_id uuid references public.companies(id) on delete set null;
alter table public.receipts add column if not exists company_id uuid references public.companies(id) on delete restrict;
alter table public.documents add column if not exists company_id uuid references public.companies(id) on delete restrict;
alter table public.subscriptions add column if not exists company_id uuid references public.companies(id) on delete restrict;
alter table public.billing_invoices add column if not exists company_id uuid references public.companies(id) on delete restrict;
alter table public.billing_issuer_settings add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.client_invitations add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.accountant_invitations add column if not exists accountant_company_id uuid references public.companies(id) on delete set null;
alter table public.master_notification_log add column if not exists target_company_ids uuid[] not null default '{}'::uuid[];

create index if not exists idx_organizations_company on public.organizations(company_id);
create index if not exists idx_receipts_company_date on public.receipts(company_id, created_at desc);
create index if not exists idx_documents_company_date on public.documents(company_id, created_at desc);
create index if not exists idx_subscriptions_company on public.subscriptions(company_id);
create index if not exists idx_billing_company on public.billing_invoices(company_id, issued_at desc);
create index if not exists idx_accountant_company_company on public.accountant_company(company_id, status);
create index if not exists idx_accountant_company_office on public.accountant_company(accountant_organization_id, status);
create index if not exists idx_access_requests_company on public.company_access_requests(company_id, status, created_at desc);
create index if not exists idx_apr_sync_runs_started on public.apr_sync_runs(started_at desc);

-- Backfill central companies: MB first, PIB second, only then normalized name.
insert into public.companies(name,normalized_name,registration_number,pib,address,municipality,legal_form,activity_code,activity_name,apr_raw,source_status,manual_review_required,created_at,updated_at)
select distinct on (o.registration_number)
  o.name, public.normalize_company_name(o.name), o.registration_number, nullif(o.pib,''), o.address, o.municipality,
  o.legal_form, o.activity_code, o.activity_name, o.apr_raw, 'legacy', false, o.created_at, now()
from public.organizations o
where o.registration_number ~ '^[0-9]{8}$'
order by o.registration_number, o.created_at asc
on conflict do nothing;

insert into public.companies(name,normalized_name,registration_number,pib,address,municipality,legal_form,activity_code,activity_name,apr_raw,source_status,manual_review_required,created_at,updated_at)
select distinct on (o.pib)
  o.name, public.normalize_company_name(o.name), nullif(o.registration_number,''), o.pib, o.address, o.municipality,
  o.legal_form, o.activity_code, o.activity_name, o.apr_raw, 'legacy', false, o.created_at, now()
from public.organizations o
where o.pib ~ '^[0-9]{9}$'
  and not exists(select 1 from public.companies c where c.pib=o.pib)
order by o.pib, o.created_at asc;

insert into public.companies(name,normalized_name,address,municipality,legal_form,activity_code,activity_name,apr_raw,source_status,manual_review_required,created_at,updated_at)
select distinct on (public.normalize_company_name(o.name))
  o.name, public.normalize_company_name(o.name), o.address, o.municipality, o.legal_form, o.activity_code, o.activity_name,
  o.apr_raw, 'manual_review', true, o.created_at, now()
from public.organizations o
where coalesce(o.registration_number,'') !~ '^[0-9]{8}$'
  and coalesce(o.pib,'') !~ '^[0-9]{9}$'
  and public.normalize_company_name(o.name) <> ''
  and not exists(select 1 from public.companies c where c.normalized_name=public.normalize_company_name(o.name))
order by public.normalize_company_name(o.name), o.created_at asc;

update public.organizations o
set company_id=c.id
from public.companies c
where o.company_id is null and o.registration_number is not null and o.registration_number=c.registration_number;

update public.organizations o
set company_id=c.id
from public.companies c
where o.company_id is null and o.pib is not null and o.pib=c.pib;

update public.organizations o
set company_id=c.id
from public.companies c
where o.company_id is null and public.normalize_company_name(o.name)=c.normalized_name;

insert into public.company_migration_review(organization_id,company_id,reason)
select o.id,o.company_id,
  case when o.company_id is null then 'Nije moguće bezbedno povezati postojeću organizaciju sa centralnom firmom.'
       when c.manual_review_required then 'Povezano samo po nazivu; proveriti MB/PIB preko APR-a.'
       else 'Više legacy organizacija je povezano sa istom centralnom firmom; proveriti eventualni duplikat.' end
from public.organizations o
left join public.companies c on c.id=o.company_id
where o.company_id is null
   or c.manual_review_required
   or (o.company_id is not null and (select count(*) from public.organizations x where x.company_id=o.company_id)>1)
on conflict(organization_id,reason) do nothing;

-- Existing duplicates are preserved for manual review, but new duplicates are blocked.
create or replace function public.prevent_duplicate_company_organization()
returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if new.company_id is not null and exists(
    select 1 from public.organizations o where o.company_id=new.company_id and o.id<>new.id
  ) then
    raise exception 'Firma već ima FiscalBox organizaciju.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_prevent_duplicate_company_org on public.organizations;
create trigger trg_prevent_duplicate_company_org
before insert or update of company_id on public.organizations
for each row execute procedure public.prevent_duplicate_company_organization();

update public.receipts r set company_id=o.company_id from public.organizations o where r.organization_id=o.id and r.company_id is null;
update public.documents d set company_id=o.company_id from public.organizations o where d.organization_id=o.id and d.company_id is null;
update public.subscriptions s set company_id=o.company_id from public.organizations o where s.organization_id=o.id and s.company_id is null;
update public.billing_invoices b set company_id=o.company_id from public.organizations o where b.organization_id=o.id and b.company_id is null;
update public.client_invitations i set company_id=c.id from public.companies c
  where i.company_id is null and ((i.company_registration_number is not null and i.company_registration_number=c.registration_number) or (i.company_pib is not null and i.company_pib=c.pib));
update public.accountant_invitations i set accountant_company_id=c.id from public.companies c
  where i.accountant_company_id is null and i.accountant_pib is not null and i.accountant_pib=c.pib;

update public.profiles p
set primary_company_id=x.company_id
from (
  select m.user_id, min(o.company_id::text)::uuid as company_id
  from public.organization_members m join public.organizations o on o.id=m.organization_id
  where o.company_id is not null and m.role in ('owner','employee')
  group by m.user_id
) x
where p.user_id=x.user_id and p.primary_company_id is null;

-- Backfill accountant-company relations from legacy accountant membership model.
insert into public.accountant_company(accountant_organization_id,company_id,client_organization_id,status,approved_at,created_at,updated_at)
select distinct ao.id, co.company_id, co.id, 'active', now(), now(), now()
from public.organization_members cm
join public.organizations co on co.id=cm.organization_id and co.organization_type='company' and co.company_id is not null
join public.organization_members am on am.user_id=cm.user_id and am.role in ('owner','employee')
join public.organizations ao on ao.id=am.organization_id and ao.organization_type='accounting'
where cm.role='accountant'
on conflict(accountant_organization_id,company_id) do update
  set client_organization_id=excluded.client_organization_id,
      status=case when public.accountant_company.status='blocked' then 'blocked' else 'active' end,
      approved_at=coalesce(public.accountant_company.approved_at,excluded.approved_at),
      updated_at=now();

create or replace function public.set_company_id_from_organization()
returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if new.organization_id is not null then
    select o.company_id into new.company_id from public.organizations o where o.id=new.organization_id;
  end if;
  return new;
end;
$$;

create or replace function public.sync_organization_official_company_fields()
returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  update public.organizations
  set name=new.name,
      pib=new.pib,
      registration_number=new.registration_number,
      legal_form=new.legal_form,
      address=new.address,
      municipality=coalesce(new.municipality,new.city),
      activity_code=new.activity_code,
      activity_name=new.activity_name,
      apr_raw=new.apr_raw
  where company_id=new.id;
  return new;
end;
$$;

drop trigger if exists trg_receipts_company_id on public.receipts;
create trigger trg_receipts_company_id before insert or update of organization_id on public.receipts for each row execute procedure public.set_company_id_from_organization();
drop trigger if exists trg_documents_company_id on public.documents;
create trigger trg_documents_company_id before insert or update of organization_id on public.documents for each row execute procedure public.set_company_id_from_organization();
drop trigger if exists trg_subscriptions_company_id on public.subscriptions;
create trigger trg_subscriptions_company_id before insert or update of organization_id on public.subscriptions for each row execute procedure public.set_company_id_from_organization();
drop trigger if exists trg_billing_company_id on public.billing_invoices;
create trigger trg_billing_company_id before insert or update of organization_id on public.billing_invoices for each row execute procedure public.set_company_id_from_organization();
drop trigger if exists trg_companies_sync_organizations on public.companies;
create trigger trg_companies_sync_organizations after update of name,pib,registration_number,legal_form,address,municipality,activity_code,activity_name,apr_raw on public.companies for each row execute procedure public.sync_organization_official_company_fields();

create or replace function public.search_companies(search_text text, result_limit integer default 15)
returns setof public.companies
language sql stable security definer set search_path=''
as $$
  with input as (
    select trim(coalesce(search_text,'')) q,
           regexp_replace(trim(coalesce(search_text,'')), '\D','','g') digits,
           public.normalize_company_name(search_text) norm
  )
  select c.*
  from public.companies c, input i
  where i.q <> '' and (
    c.registration_number=i.digits or c.pib=i.digits or
    c.normalized_name ilike '%'||i.norm||'%'
  )
  order by
    case when c.registration_number=i.digits then 0
         when c.pib=i.digits then 1
         when c.normalized_name=i.norm then 2
         when c.normalized_name like i.norm||'%' then 3
         else 4 end,
    -- pg_trgm may live in Supabase's extensions schema.  Do not depend on an
    -- unqualified similarity() call here; exact/prefix matches are already
    -- ranked above, then prefer the closest normalized-name length.
    abs(length(c.normalized_name) - length(i.norm)) asc,
    c.name asc
  limit greatest(1,least(coalesce(result_limit,15),20));
$$;

create or replace function public.check_company_search_rate_limit(p_key text, p_limit integer default 30, p_window_seconds integer default 60)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare rec public.company_search_rate_limits%rowtype;
begin
  select * into rec from public.company_search_rate_limits where rate_key=p_key for update;
  if not found then
    insert into public.company_search_rate_limits(rate_key,window_started_at,request_count) values(p_key,now(),1);
    return true;
  end if;
  if rec.window_started_at < now() - make_interval(secs=>p_window_seconds) then
    update public.company_search_rate_limits set window_started_at=now(),request_count=1 where rate_key=p_key;
    return true;
  end if;
  if rec.request_count >= p_limit then return false; end if;
  update public.company_search_rate_limits set request_count=request_count+1 where rate_key=p_key;
  return true;
end;
$$;

create or replace function public.can_view_company(target_company uuid)
returns boolean
language sql stable security definer set search_path=''
as $$
  select public.is_master_admin()
  or exists(
    select 1 from public.organization_members m
    join public.organizations o on o.id=m.organization_id
    where m.user_id=auth.uid() and o.company_id=target_company
  )
  or exists(
    select 1 from public.accountant_company ac
    join public.organization_members m on m.organization_id=ac.accountant_organization_id
    where ac.company_id=target_company and ac.status='active' and m.user_id=auth.uid()
  );
$$;

alter table public.companies enable row level security;
alter table public.company_access_requests enable row level security;
alter table public.accountant_company enable row level security;
alter table public.apr_sync_runs enable row level security;
alter table public.company_audit_log enable row level security;
alter table public.company_migration_review enable row level security;
alter table public.company_search_rate_limits enable row level security;

drop policy if exists "associated users view companies" on public.companies;
create policy "associated users view companies" on public.companies for select using(public.can_view_company(id));

drop policy if exists "requester or company admin views access request" on public.company_access_requests;
create policy "requester or company admin views access request" on public.company_access_requests for select
using(requester_user_id=auth.uid() or public.is_master_admin() or exists(
  select 1 from public.organizations o where o.company_id=company_access_requests.company_id and public.is_org_owner(o.id)
));

drop policy if exists "requester creates access request" on public.company_access_requests;
create policy "requester creates access request" on public.company_access_requests for insert
with check(requester_user_id=auth.uid());

drop policy if exists "company admin reviews access request" on public.company_access_requests;
create policy "company admin reviews access request" on public.company_access_requests for update
using(public.is_master_admin() or exists(
  select 1 from public.organizations o where o.company_id=company_access_requests.company_id and public.is_org_owner(o.id)
));

drop policy if exists "related users view accountant company" on public.accountant_company;
create policy "related users view accountant company" on public.accountant_company for select
using(public.is_master_admin() or public.is_accounting_office_member(accountant_organization_id) or exists(
  select 1 from public.organizations o where o.company_id=accountant_company.company_id and public.is_org_owner(o.id)
));

drop policy if exists "office creates accountant company request" on public.accountant_company;
create policy "office creates accountant company request" on public.accountant_company for insert
with check(public.is_accounting_office_member(accountant_organization_id) or public.is_master_admin());

drop policy if exists "related admin updates accountant company" on public.accountant_company;
create policy "related admin updates accountant company" on public.accountant_company for update
using(public.is_master_admin() or public.is_accounting_office_admin(accountant_organization_id) or exists(
  select 1 from public.organizations o where o.company_id=accountant_company.company_id and public.is_org_owner(o.id)
));

drop policy if exists "master views apr sync" on public.apr_sync_runs;
create policy "master views apr sync" on public.apr_sync_runs for select using(public.is_master_admin());
drop policy if exists "master views company audit" on public.company_audit_log;
create policy "master views company audit" on public.company_audit_log for select using(public.is_master_admin());
drop policy if exists "master views migration review" on public.company_migration_review;
create policy "master views migration review" on public.company_migration_review for all using(public.is_master_admin()) with check(public.is_master_admin());

-- Only backend service role may call internal search/rate-limit helpers directly.
revoke all on function public.search_companies(text,integer) from public, anon, authenticated;
grant execute on function public.search_companies(text,integer) to service_role;
revoke all on function public.check_company_search_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.check_company_search_rate_limit(text,integer,integer) to service_role;
