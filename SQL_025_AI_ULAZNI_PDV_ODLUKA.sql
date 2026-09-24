begin;

alter table public.receipts add column if not exists ai_vat_recommendation text;
alter table public.receipts add column if not exists ai_vat_confidence integer;
alter table public.receipts add column if not exists ai_vat_reason text;
alter table public.receipts add column if not exists ai_vat_basis jsonb;
alter table public.receipts add column if not exists ai_vat_analyzed_at timestamptz;
alter table public.receipts add column if not exists vat_deductible boolean;
alter table public.receipts add column if not exists vat_decided_at timestamptz;
alter table public.receipts add column if not exists vat_decided_by uuid references auth.users(id) on delete set null;
alter table public.receipts add column if not exists vat_decision_note text;

alter table public.receipts drop constraint if exists receipts_ai_vat_recommendation_check;
alter table public.receipts add constraint receipts_ai_vat_recommendation_check
  check (ai_vat_recommendation is null or ai_vat_recommendation in ('da','ne','provera'));

alter table public.receipts drop constraint if exists receipts_ai_vat_confidence_check;
alter table public.receipts add constraint receipts_ai_vat_confidence_check
  check (ai_vat_confidence is null or (ai_vat_confidence between 0 and 100));

create table if not exists public.receipt_vat_decision_log (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  accountant_user_id uuid not null references auth.users(id) on delete restrict,
  vat_deductible boolean not null,
  ai_recommendation text,
  ai_confidence integer,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_receipt_vat_decision_log_receipt on public.receipt_vat_decision_log(receipt_id,created_at desc);
create index if not exists idx_receipts_vat_period on public.receipts(organization_id,sdc_time,vat_deductible);

alter table public.receipt_vat_decision_log enable row level security;

drop policy if exists "vat log accountant select" on public.receipt_vat_decision_log;
create policy "vat log accountant select" on public.receipt_vat_decision_log for select
using (public.is_master_admin() or public.is_accountant_for_org(organization_id));

commit;
