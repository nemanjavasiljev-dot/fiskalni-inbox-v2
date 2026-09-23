-- FiscalBox V5.5: PIB-first company lookup with NBS verification + APR local merge.
-- Safe to run after V5.4 / SQL 012.

alter table public.companies add column if not exists short_name text;
alter table public.companies add column if not exists nbs_raw jsonb;
alter table public.companies add column if not exists nbs_last_check timestamptz;
alter table public.companies add column if not exists registry_checked_at timestamptz;
alter table public.companies add column if not exists registry_source text;

-- Allow the central company record to remember how it was resolved.
alter table public.companies drop constraint if exists companies_source_status_check;
alter table public.companies
  add constraint companies_source_status_check
  check (source_status in ('apr','legacy','manual_review','nbs','nbs_apr'));

-- PIB already has a partial unique index from V5.1; keep an explicit lookup index
-- for installations upgraded from older snapshots.
create unique index if not exists idx_companies_pib_unique
  on public.companies(pib)
  where pib is not null and pib <> '';

create index if not exists idx_companies_registry_checked
  on public.companies(registry_checked_at desc nulls last);

-- Existing APR rows get a descriptive source label without changing their data.
update public.companies
set registry_source = 'APR'
where registry_source is null and apr_source_id is not null;
