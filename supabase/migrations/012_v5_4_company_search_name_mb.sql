-- FiscalBox V5.4: company search by company name or registration number (MB) only.
-- Restores the RPC signature expected by the application: search_companies(text, integer).

create extension if not exists pg_trgm;

-- Remove all older overloads to avoid ambiguous RPC/function resolution.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as func_signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'search_companies'
  loop
    execute 'drop function ' || r.func_signature;
  end loop;
end $$;

create or replace function public.search_companies(
  search_text text,
  result_limit integer default 15
)
returns setof public.companies
language sql
stable
security definer
set search_path = ''
as $$
  with input as (
    select
      trim(coalesce(search_text,'')) as q,
      regexp_replace(trim(coalesce(search_text,'')), '\D', '', 'g') as digits,
      public.normalize_company_name(search_text) as norm
  )
  select c.*
  from public.companies c, input i
  where length(i.q) >= 2
    and (
      (
        i.digits <> ''
        and c.registration_number like i.digits || '%'
      )
      or (
        i.norm <> ''
        and c.normalized_name ilike '%' || i.norm || '%'
      )
    )
  order by
    case
      when c.registration_number = i.digits then 0
      when i.digits <> '' and c.registration_number like i.digits || '%' then 1
      when c.normalized_name = i.norm then 2
      when c.normalized_name like i.norm || '%' then 3
      else 4
    end,
    abs(length(c.normalized_name) - length(i.norm)) asc,
    c.name asc
  limit greatest(1, least(coalesce(result_limit, 15), 20));
$$;

-- Search is called only by the server-side API route through the service role.
revoke all on function public.search_companies(text,integer) from public, anon, authenticated;
grant execute on function public.search_companies(text,integer) to service_role;
