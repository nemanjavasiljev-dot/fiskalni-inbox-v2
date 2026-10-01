-- FiscalBox V5.9.3.8
-- SUPER ADMIN: edit firmi/knjigovodja, admin/employee prava, marketing attachmenti,
-- APR kontakt email i puna podrska za registre privrednih drustava + preduzetnika.

begin;

alter table public.companies
  add column if not exists contact_email text,
  add column if not exists contact_email_source text,
  add column if not exists contact_email_updated_at timestamptz;

create index if not exists idx_companies_contact_email
  on public.companies(lower(contact_email))
  where contact_email is not null and contact_email <> '';

alter table public.organization_members
  add column if not exists organization_access_role text not null default 'user';

alter table public.organization_members drop constraint if exists organization_members_organization_access_role_check;
alter table public.organization_members add constraint organization_members_organization_access_role_check
  check (organization_access_role in ('admin','user'));

-- Vlasnik je uvek admin. Za knjigovodstvene agencije postojece privilegije zadrzavamo i preslikavamo.
update public.organization_members m
set organization_access_role='admin'
from public.organizations o
where o.id=m.organization_id and o.owner_user_id=m.user_id;

update public.organization_members m
set organization_access_role=coalesce(m.accounting_access_role,'user')
from public.organizations o
where o.id=m.organization_id
  and o.organization_type='accounting'
  and m.role='employee';

-- Admin zaposleni firme dobija owner-like administrativna prava tamo gde sistem vec koristi is_org_owner().
create or replace function public.is_org_owner(org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id=m.organization_id
    where m.organization_id=org
      and m.user_id=auth.uid()
      and m.role in ('owner','employee')
      and (o.owner_user_id=auth.uid() or m.organization_access_role='admin')
  ) or public.is_master_admin();
$$;

-- APR email ide u centralni registar samo ako ga zvanicni APR feed/API vrati.
-- Funkcija je kompatibilna sa postojecim bulk sync-om i dodatnim registrom preduzetnika.
create or replace function public.bulk_upsert_apr_companies(p_rows jsonb, p_run_id uuid default null)
returns table(inserted_count integer, updated_count integer)
language plpgsql
security definer
set search_path=''
as $$
declare
  before_count integer;
  after_count integer;
begin
  select count(*) into before_count from public.companies;

  insert into public.companies(
    name,normalized_name,registration_number,pib,address,city,municipality,postal_code,
    legal_form,activity_code,activity_name,registry_status,founded_at,apr_source_id,
    apr_last_sync,apr_raw,source_status,manual_review_required,registry_kind,
    contact_email,contact_email_source,contact_email_updated_at,updated_at
  )
  select
    nullif(trim(x.name),'') as name,
    public.normalize_company_name(x.name),
    nullif(regexp_replace(coalesce(x.registration_number,''),'\D','','g'),''),
    case
      when regexp_replace(coalesce(x.pib,''),'\D','','g') ~ '^\d{9}$'
      then regexp_replace(coalesce(x.pib,''),'\D','','g')
      else null
    end,
    nullif(x.address,''), nullif(x.city,''), nullif(x.municipality,''), nullif(x.postal_code,''),
    nullif(x.legal_form,''), nullif(x.activity_code,''), nullif(x.activity_name,''), nullif(x.registry_status,''),
    case when coalesce(x.founded_at,'') ~ '^\d{4}-\d{2}-\d{2}$' then x.founded_at::date else null end,
    coalesce(nullif(x.apr_source_id,''),nullif(x.registration_number,'')),
    now(), x.apr_raw, 'apr', false,
    case when x.registry_kind='entrepreneur' then 'entrepreneur' when x.registry_kind='other' then 'other' else 'company' end,
    nullif(lower(trim(x.contact_email)),''),
    case when nullif(trim(x.contact_email),'') is not null then 'apr' else null end,
    case when nullif(trim(x.contact_email),'') is not null then now() else null end,
    now()
  from jsonb_to_recordset(coalesce(p_rows,'[]'::jsonb)) as x(
    name text, registration_number text, pib text, address text, city text, municipality text,
    postal_code text, legal_form text, activity_code text, activity_name text, registry_status text,
    founded_at text, apr_source_id text, apr_raw jsonb, registry_kind text, contact_email text
  )
  where nullif(trim(x.name),'') is not null
    and regexp_replace(coalesce(x.registration_number,''),'\D','','g') ~ '^\d{8}$'
  on conflict (registration_number) where registration_number is not null and registration_number <> ''
  do update set
    name=excluded.name,
    normalized_name=excluded.normalized_name,
    pib=coalesce(excluded.pib,public.companies.pib),
    address=coalesce(excluded.address,public.companies.address),
    city=coalesce(excluded.city,public.companies.city),
    municipality=coalesce(excluded.municipality,public.companies.municipality),
    postal_code=coalesce(excluded.postal_code,public.companies.postal_code),
    legal_form=coalesce(excluded.legal_form,public.companies.legal_form),
    activity_code=coalesce(excluded.activity_code,public.companies.activity_code),
    activity_name=coalesce(excluded.activity_name,public.companies.activity_name),
    registry_status=coalesce(excluded.registry_status,public.companies.registry_status),
    founded_at=coalesce(excluded.founded_at,public.companies.founded_at),
    apr_source_id=coalesce(excluded.apr_source_id,public.companies.apr_source_id),
    apr_last_sync=excluded.apr_last_sync,
    apr_raw=excluded.apr_raw,
    registry_kind=case
      when excluded.registry_kind='entrepreneur' then 'entrepreneur'
      when public.companies.registry_kind='entrepreneur' then 'entrepreneur'
      else excluded.registry_kind
    end,
    contact_email=coalesce(excluded.contact_email,public.companies.contact_email),
    contact_email_source=case when excluded.contact_email is not null then 'apr' else public.companies.contact_email_source end,
    contact_email_updated_at=case when excluded.contact_email is not null then now() else public.companies.contact_email_updated_at end,
    source_status='apr',
    manual_review_required=false,
    updated_at=now();

  get diagnostics updated_count = row_count;
  select count(*) into after_count from public.companies;
  inserted_count := greatest(0,after_count-before_count);
  updated_count := greatest(0,updated_count-inserted_count);
  return next;
end;
$$;

revoke all on function public.bulk_upsert_apr_companies(jsonb,uuid) from public, anon, authenticated;
grant execute on function public.bulk_upsert_apr_companies(jsonb,uuid) to service_role;

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text,
  subject text not null,
  body text not null,
  target_kind text not null default 'selected' check (target_kind in ('selected','companies','accounting','all')),
  target_organization_ids uuid[] not null default '{}'::uuid[],
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  status text not null default 'draft' check (status in ('draft','sending','sent','partial','failed')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.marketing_campaign_attachments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_marketing_campaigns_created on public.marketing_campaigns(created_at desc);
create index if not exists idx_marketing_attachments_campaign on public.marketing_campaign_attachments(campaign_id);

alter table public.marketing_campaigns enable row level security;
alter table public.marketing_campaign_attachments enable row level security;

drop policy if exists master_marketing_campaigns on public.marketing_campaigns;
create policy master_marketing_campaigns on public.marketing_campaigns for all
using (public.is_master_admin()) with check (public.is_master_admin());

drop policy if exists master_marketing_attachments on public.marketing_campaign_attachments;
create policy master_marketing_attachments on public.marketing_campaign_attachments for all
using (public.is_master_admin()) with check (public.is_master_admin());

insert into storage.buckets(id,name,public,file_size_limit)
values ('marketing-assets','marketing-assets',false,10485760)
on conflict (id) do update set public=false,file_size_limit=10485760;

alter table public.master_notification_log
  add column if not exists marketing_campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  add column if not exists attachment_names text[] not null default '{}'::text[];

commit;
