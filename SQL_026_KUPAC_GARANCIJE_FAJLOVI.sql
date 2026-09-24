begin;

alter table public.receipts
  add column if not exists buyer_name text,
  add column if not exists buyer_registration_number text,
  add column if not exists buyer_address text,
  add column if not exists buyer_city text,
  add column if not exists buyer_registry_source text,
  add column if not exists warranty_archived_at timestamptz,
  add column if not exists warranty_source text,
  add column if not exists warranty_note text;

create index if not exists idx_receipts_org_warranty
  on public.receipts(organization_id, warranty_archived_at desc)
  where warranty_archived_at is not null;

-- Postojeći računi iz očigledne kategorije IT oprema ulaze u Garancije kao početna arhiva.
update public.receipts
set warranty_archived_at = coalesce(warranty_archived_at, created_at, now()),
    warranty_source = coalesce(warranty_source, 'auto_category'),
    warranty_note = coalesce(warranty_note, 'Automatski arhivirano: kategorija IT oprema tipično sadrži robu sa garancijom.')
where warranty_archived_at is null and category = 'IT oprema';

commit;
