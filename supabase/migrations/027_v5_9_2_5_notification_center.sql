begin;

-- V5.9.2.5: centar notifikacija za USER/FIRMA i KNJIGOVOĐU.
-- Brisanje je "soft delete" kako se poslovni trag ne bi fizički izgubio.
alter table public.user_notifications
  add column if not exists deleted_at timestamptz,
  add column if not exists reaction text,
  add column if not exists reacted_at timestamptz;

alter table public.user_notifications drop constraint if exists user_notifications_reaction_check;
alter table public.user_notifications add constraint user_notifications_reaction_check
  check (reaction is null or reaction in ('received','important','thanks','done'));

create index if not exists idx_user_notifications_active_user_created
  on public.user_notifications(user_id,created_at desc)
  where deleted_at is null;

-- Zadržavamo postojeću RLS politiku: korisnik može da menja samo svoje notifikacije.
-- Dozvoljavamo samo kolone koje pripadaju centru notifikacija.
revoke update on public.user_notifications from authenticated;
grant update (read_at,deleted_at,reaction,reacted_at) on public.user_notifications to authenticated;

commit;
