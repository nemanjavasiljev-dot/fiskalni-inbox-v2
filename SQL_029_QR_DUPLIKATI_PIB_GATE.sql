begin;

alter table public.receipts
  add column if not exists receipt_fingerprint text,
  add column if not exists buyer_pib_status text not null default 'unknown',
  add column if not exists saved_without_buyer_pib boolean not null default false,
  add column if not exists bookkeeping_eligible boolean not null default true;

alter table public.receipts drop constraint if exists receipts_buyer_pib_status_check;
alter table public.receipts
  add constraint receipts_buyer_pib_status_check
  check (buyer_pib_status in ('unknown','present','missing'));

update public.receipts
set buyer_pib_status='present'
where buyer_pib_status='unknown'
  and buyer_pib is not null
  and regexp_replace(buyer_pib,'[^0-9]','','g') ~ '^[0-9]{9}$';

-- Bezbedan backfill: samo prvi postojeći zapis dobija fingerprint.
-- Ako su istorijski već postojali duplikati, ništa se ne briše automatski.
with candidates as (
  select
    id,
    organization_id,
    'v1:' || coalesce(nullif(regexp_replace(coalesce(merchant_pib,''),'[^0-9]','','g'),''),'-') || '|' ||
    upper(regexp_replace(coalesce(invoice_number,''),'[[:space:]]+','','g')) || '|' ||
    coalesce(to_char(sdc_time at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'-') as fp
  from public.receipts
  where receipt_fingerprint is null
    and nullif(trim(coalesce(invoice_number,'')),'') is not null
), ranked as (
  select id,fp,row_number() over(partition by organization_id,fp order by id) as rn
  from candidates
)
update public.receipts r
set receipt_fingerprint=ranked.fp
from ranked
where r.id=ranked.id and ranked.rn=1;

create unique index if not exists uq_receipts_org_fingerprint
  on public.receipts(organization_id,receipt_fingerprint)
  where receipt_fingerprint is not null;

create index if not exists idx_receipts_buyer_pib_status
  on public.receipts(organization_id,buyer_pib_status,created_at desc);

create index if not exists idx_receipts_bookkeeping_eligible
  on public.receipts(organization_id,bookkeeping_eligible,created_at desc);

commit;
