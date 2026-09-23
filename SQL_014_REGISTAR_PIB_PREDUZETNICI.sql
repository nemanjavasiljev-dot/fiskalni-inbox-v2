-- FiscalBox V5.8
-- 1) pouzdan PIB iz APR raw podataka kada je dostupan
-- 2) priprema jedinstvenog registra za privredna društva + preduzetnike
-- 3) bulk sync sada ažurira PIB, ne ostavlja ga zauvek NULL

alter table public.companies
  add column if not exists registry_kind text not null default 'company';

alter table public.companies drop constraint if exists companies_registry_kind_check;
alter table public.companies
  add constraint companies_registry_kind_check
  check (registry_kind in ('company','entrepreneur','other'));

create index if not exists idx_companies_registry_kind
  on public.companies(registry_kind);

-- Rekurzivno pronalazi PIB samo ispod eksplicitnih PIB/tax ključeva.
-- Ne pokušava da pogađa bilo koji slučajni devetocifreni broj.
create or replace function public.extract_pib_from_apr_raw(payload jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  v jsonb;
  candidate text;
  nested text;
begin
  if payload is null then return null; end if;

  if jsonb_typeof(payload) = 'object' then
    for k, v in select key, value from jsonb_each(payload)
    loop
      if lower(regexp_replace(k, '[^a-zA-Z0-9]', '', 'g')) in (
        'pib','poreskibroj','taxidentificationnumber','taxid','taxnumber'
      ) then
        candidate := regexp_replace(trim(both '"' from v::text), '\D', '', 'g');
        if candidate ~ '^\d{9}$' then return candidate; end if;
      end if;

      if jsonb_typeof(v) in ('object','array') then
        nested := public.extract_pib_from_apr_raw(v);
        if nested is not null then return nested; end if;
      end if;
    end loop;
  elsif jsonb_typeof(payload) = 'array' then
    for v in select value from jsonb_array_elements(payload)
    loop
      if jsonb_typeof(v) in ('object','array') then
        nested := public.extract_pib_from_apr_raw(v);
        if nested is not null then return nested; end if;
      end if;
    end loop;
  end if;

  return null;
end;
$$;

-- Pokušaj da popuniš PIB iz već sačuvanog APR raw zapisa, bez novog download-a.
update public.companies c
set pib = public.extract_pib_from_apr_raw(c.apr_raw),
    updated_at = now()
where c.pib is null
  and public.extract_pib_from_apr_raw(c.apr_raw) is not null
  and not exists (
    select 1 from public.companies other
    where other.id <> c.id
      and other.pib = public.extract_pib_from_apr_raw(c.apr_raw)
  );

-- Bulk sync: dodaje registry_kind i, najvažnije, PIB ažurira i kod postojećih redova.
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
    apr_last_sync,apr_raw,source_status,manual_review_required,registry_kind,updated_at
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
    case when x.registry_kind='entrepreneur' then 'entrepreneur' else 'company' end,
    now()
  from jsonb_to_recordset(coalesce(p_rows,'[]'::jsonb)) as x(
    name text, registration_number text, pib text, address text, city text, municipality text,
    postal_code text, legal_form text, activity_code text, activity_name text, registry_status text,
    founded_at text, apr_source_id text, apr_raw jsonb, registry_kind text
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
      else public.companies.registry_kind
    end,
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

-- Jedna pretraga za oba tipa subjekata. PIB je dozvoljen kao tačan kriterijum,
-- naziv i MB rade kao i do sada.
create or replace function public.search_companies(search_text text, result_limit integer default 15)
returns setof public.companies
language sql
stable
security definer
set search_path=''
as $$
  with input as (
    select trim(coalesce(search_text,'')) q,
           regexp_replace(trim(coalesce(search_text,'')), '\D','','g') digits,
           public.normalize_company_name(search_text) norm
  )
  select c.*
  from public.companies c, input i
  where length(i.q) >= 2 and (
    (i.digits <> '' and c.registration_number like i.digits || '%') or
    (length(i.digits)=9 and c.pib=i.digits) or
    (i.norm <> '' and c.normalized_name ilike '%'||i.norm||'%')
  )
  order by
    case when c.registration_number=i.digits then 0
         when c.pib=i.digits then 1
         when c.normalized_name=i.norm then 2
         when c.normalized_name like i.norm||'%' then 3
         else 4 end,
    case when c.registry_kind='entrepreneur' then 1 else 0 end,
    abs(length(c.normalized_name)-length(i.norm)) asc,
    c.name asc
  limit greatest(1,least(coalesce(result_limit,15),20));
$$;

revoke all on function public.search_companies(text,integer) from public, anon, authenticated;
grant execute on function public.search_companies(text,integer) to service_role;

select
  count(*) filter (where registry_kind='company') as privredna_drustva,
  count(*) filter (where registry_kind='entrepreneur') as preduzetnici,
  count(*) filter (where pib is not null) as subjekti_sa_pibom,
  count(*) as ukupno
from public.companies;
