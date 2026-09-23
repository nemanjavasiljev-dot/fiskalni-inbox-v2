-- FiscalBox V5.3: reliable APR Open Data bulk synchronization
-- The APR /api/opendata/companies endpoint is a whole-dataset snapshot, not a search API.
-- Import it outside the request path, then search the local central companies table.

create or replace function public.normalize_company_name(value text)
returns text
language sql immutable
as $$
  select trim(regexp_replace(
    translate(
      replace(replace(replace(replace(replace(lower(coalesce(value,'')), 'љ','lj'), 'њ','nj'), 'џ','dz'), 'ђ','dj'), 'ћ','c'),
      'абвгдежзијклмнопрстуфхцчшčćžšđ',
      'abvgdezzijklmnoprstufhccscczsd'
    ),
    '[^a-z0-9]+',' ','g'
  ));
$$;

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
    apr_last_sync,apr_raw,source_status,manual_review_required,updated_at
  )
  select
    nullif(trim(x.name),'') as name,
    public.normalize_company_name(x.name),
    nullif(regexp_replace(coalesce(x.registration_number,''),'\D','','g'),''),
    nullif(regexp_replace(coalesce(x.pib,''),'\D','','g'),''),
    nullif(x.address,''), nullif(x.city,''), nullif(x.municipality,''), nullif(x.postal_code,''),
    nullif(x.legal_form,''), nullif(x.activity_code,''), nullif(x.activity_name,''), nullif(x.registry_status,''),
    case when coalesce(x.founded_at,'') ~ '^\d{4}-\d{2}-\d{2}$' then x.founded_at::date else null end,
    coalesce(nullif(x.apr_source_id,''),nullif(x.registration_number,'')),
    now(), x.apr_raw, 'apr', false, now()
  from jsonb_to_recordset(coalesce(p_rows,'[]'::jsonb)) as x(
    name text, registration_number text, pib text, address text, city text, municipality text,
    postal_code text, legal_form text, activity_code text, activity_name text, registry_status text,
    founded_at text, apr_source_id text, apr_raw jsonb
  )
  where nullif(trim(x.name),'') is not null
    and regexp_replace(coalesce(x.registration_number,''),'\D','','g') ~ '^\d{8}$'
  on conflict (registration_number) where registration_number is not null and registration_number <> ''
  do update set
    name=excluded.name,
    normalized_name=excluded.normalized_name,
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

-- Recreate search with the improved Serbian Cyrillic/Latin normalizer.
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
    abs(length(c.normalized_name)-length(i.norm)) asc,
    c.name asc
  limit greatest(1,least(coalesce(result_limit,15),20));
$$;
