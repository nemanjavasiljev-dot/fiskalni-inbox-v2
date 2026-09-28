-- FiscalBox V5.9.3.7
-- Fallback kada QR fiskalnog racuna nije citljiv: fotografija celog racuna ostaje u fiskalnim racunima.

begin;

alter table public.receipts
  add column if not exists receipt_source text not null default 'qr',
  add column if not exists source_image_path text,
  add column if not exists source_image_name text,
  add column if not exists source_image_mime text;

alter table public.receipts drop constraint if exists receipts_receipt_source_check;
alter table public.receipts
  add constraint receipts_receipt_source_check
  check (receipt_source in ('qr','photo'));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('receipt-images','receipt-images',false,15728640,array['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update
set public=false,
    file_size_limit=15728640,
    allowed_mime_types=array['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif'];

create index if not exists idx_receipts_photo_source
  on public.receipts(organization_id,created_at desc)
  where receipt_source='photo';

commit;
