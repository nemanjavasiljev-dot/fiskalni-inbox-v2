begin;

-- FiscalBox V5.9.2.9: interni inbox za USER/FIRMA, KNJIGOVOĐU i SUPER ADMIN.
create table if not exists public.user_messages (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  subject text not null default 'Poruka',
  body text not null,
  parent_message_id uuid references public.user_messages(id) on delete set null,
  read_at timestamptz,
  deleted_by_sender_at timestamptz,
  deleted_by_recipient_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint user_messages_body_not_blank check (length(btrim(body)) > 0),
  constraint user_messages_subject_not_blank check (length(btrim(subject)) > 0),
  constraint user_messages_not_self check (sender_user_id <> recipient_user_id)
);

create index if not exists idx_user_messages_recipient_created on public.user_messages(recipient_user_id,created_at desc);
create index if not exists idx_user_messages_sender_created on public.user_messages(sender_user_id,created_at desc);
create index if not exists idx_user_messages_unread on public.user_messages(recipient_user_id,created_at desc) where read_at is null and deleted_by_recipient_at is null;

alter table public.user_messages enable row level security;
drop policy if exists user_messages_select_own on public.user_messages;
drop policy if exists user_messages_insert_own on public.user_messages;
drop policy if exists user_messages_update_own on public.user_messages;
create policy user_messages_select_own on public.user_messages for select to authenticated using (
  (sender_user_id=auth.uid() and deleted_by_sender_at is null)
  or (recipient_user_id=auth.uid() and deleted_by_recipient_at is null)
);
create policy user_messages_insert_own on public.user_messages for insert to authenticated with check (sender_user_id=auth.uid() and recipient_user_id<>auth.uid());
create policy user_messages_update_own on public.user_messages for update to authenticated using (sender_user_id=auth.uid() or recipient_user_id=auth.uid()) with check (sender_user_id=auth.uid() or recipient_user_id=auth.uid());

revoke delete on public.user_messages from authenticated;
grant select,insert on public.user_messages to authenticated;
revoke update on public.user_messages from authenticated;
grant update (read_at,deleted_by_sender_at,deleted_by_recipient_at) on public.user_messages to authenticated;

commit;
