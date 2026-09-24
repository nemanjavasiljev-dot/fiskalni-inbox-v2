begin;

-- V5.9.1.6: pouzdanije notifikacije + dokument knjigovođa -> klijent + arhiva.
alter table public.documents
  add column if not exists direction text not null default 'client_to_accountant',
  add column if not exists accountant_message text,
  add column if not exists archived_at timestamptz,
  add column if not exists sent_from_organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists sent_to_client_at timestamptz,
  add column if not exists sent_to_client_by uuid references auth.users(id) on delete set null;

alter table public.documents drop constraint if exists documents_direction_check;
alter table public.documents add constraint documents_direction_check
  check (direction in ('client_to_accountant','accountant_to_client'));

create index if not exists idx_documents_org_direction_archive
  on public.documents(organization_id,direction,archived_at desc,created_at desc);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  event_key text not null,
  tag text,
  notification_type text not null default 'system',
  title text not null,
  body text not null,
  url text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id,event_key)
);

create index if not exists idx_user_notifications_user_created
  on public.user_notifications(user_id,created_at desc);
create index if not exists idx_user_notifications_user_unread
  on public.user_notifications(user_id,read_at,created_at desc);

alter table public.user_notifications enable row level security;
drop policy if exists "user reads own notifications" on public.user_notifications;
create policy "user reads own notifications" on public.user_notifications for select
  using (user_id=auth.uid() or public.is_master_admin());
drop policy if exists "user updates own notifications" on public.user_notifications;
create policy "user updates own notifications" on public.user_notifications for update
  using (user_id=auth.uid() or public.is_master_admin())
  with check (user_id=auth.uid() or public.is_master_admin());

revoke insert, delete on public.user_notifications from anon, authenticated;
grant select, update (read_at) on public.user_notifications to authenticated;


-- Prihvatanje zahteva i opcionalna dodela zaposlenom rade u jednoj transakciji.
create or replace function public.respond_connection_request_v2(
  p_request uuid, p_actor uuid, p_recipient uuid, p_decision text, p_employee uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  req public.connection_requests;
  sender public.organizations;
  recipient public.organizations;
  office public.organizations;
  client public.organizations;
  actor_email text;
  accountant_user uuid;
  existing_role text;
begin
  if p_decision not in ('approve','reject') then raise exception 'Nepoznata odluka'; end if;
  select * into req from public.connection_requests where id=p_request for update;
  if not found or req.status<>'pending' or req.expires_at<=now() then raise exception 'Zahtev više nije aktivan'; end if;
  select * into recipient from public.organizations where id=p_recipient;
  if not found or recipient.organization_type<>req.target_kind then raise exception 'Pogrešan primalac'; end if;
  if not exists(select 1 from public.organization_members where organization_id=p_recipient and user_id=p_actor
    and (role='owner' or (role='employee' and accounting_access_role='admin'))) then raise exception 'Nedovoljna prava'; end if;
  select lower(email) into actor_email from auth.users where id=p_actor and email_confirmed_at is not null;
  if actor_email is null then raise exception 'Email nije potvrđen'; end if;
  if req.target_organization_id is not null then
    if req.target_organization_id<>p_recipient then raise exception 'Zahtev pripada drugoj organizaciji'; end if;
  elsif req.channel<>'email' or lower(req.recipient_email) is distinct from actor_email then
    raise exception 'Identitet primaoca nije potvrđen';
  end if;

  if p_decision='approve' then
    select * into sender from public.organizations where id=req.sender_organization_id;
    if not found or sender.organization_type=recipient.organization_type then raise exception 'Neispravne organizacije'; end if;
    if sender.organization_type='accounting' then office:=sender; client:=recipient;
    else office:=recipient; client:=sender; end if;
    if client.company_id is null then raise exception 'Firma nije povezana sa registrom'; end if;

    if p_employee is not null then
      if recipient.organization_type<>'accounting' then raise exception 'Zaposleni se bira samo kada knjigovodstvena agencija prima novog klijenta'; end if;
      if not exists(select 1 from public.organization_members where organization_id=office.id and user_id=p_employee and role='employee') then
        raise exception 'Izabrani zaposleni nije član knjigovodstvene agencije';
      end if;
      select role into existing_role from public.organization_members where organization_id=client.id and user_id=p_employee;
      if existing_role is not null and existing_role<>'accountant' then raise exception 'Zaposleni već ima drugu ulogu u firmi klijenta'; end if;
    end if;

    insert into public.accountant_company(accountant_organization_id,company_id,client_organization_id,status,requested_by,approved_by,approved_at,updated_at)
    values(office.id,client.company_id,client.id,'active',req.sender_user_id,p_actor,now(),now())
    on conflict(accountant_organization_id,company_id) do update set
      client_organization_id=excluded.client_organization_id,status='active',approved_by=p_actor,approved_at=now(),updated_at=now();

    for accountant_user in select distinct x.uid from (values (office.owner_user_id),
      (case when recipient.id=office.id then p_actor else null::uuid end)) x(uid) where x.uid is not null loop
      insert into public.organization_members(organization_id,user_id,role)
      values(client.id,accountant_user,'accountant') on conflict(organization_id,user_id) do nothing;
    end loop;

    if p_employee is not null then
      insert into public.organization_members(organization_id,user_id,role)
      values(client.id,p_employee,'accountant')
      on conflict(organization_id,user_id) do update set role='accountant';
      insert into public.accountant_client_assignments(accounting_organization_id,employee_user_id,client_organization_id,assigned_by,created_at)
      values(office.id,p_employee,client.id,p_actor,now())
      on conflict(accounting_organization_id,employee_user_id,client_organization_id) do update set assigned_by=p_actor;
    end if;
  end if;

  update public.connection_requests set status=case when p_decision='approve' then 'accepted' else 'rejected' end,
    target_organization_id=p_recipient,responded_at=now(),responded_by=p_actor,updated_at=now() where id=p_request;
  return jsonb_build_object('ok',true,'assigned_to',p_employee);
end;
$$;
revoke all on function public.respond_connection_request_v2(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.respond_connection_request_v2(uuid,uuid,uuid,text,uuid) to service_role;

commit;
