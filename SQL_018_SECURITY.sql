begin;
-- Deactivate only the known legacy bootstrap account that still requires a password change.
update public.profiles p set global_role='user'
from auth.users u where u.id=p.user_id and u.email='master@fiscalbox.local'
  and coalesce(u.raw_user_meta_data->>'must_change_master_credentials','false')='true';
-- Privileged metadata changes go through authenticated server handlers only.
revoke insert, update, delete on public.profiles, public.organizations,
  public.organization_members, public.subscriptions, public.company_access_requests,
  public.accountant_company, public.accountant_client_assignments,
  public.accountant_invitations, public.client_invitations, public.connection_requests
  from public, anon, authenticated;
-- Organization preferences are now written by authorized server handlers.

-- A submitted storage path must never point at another tenant's object.
drop policy if exists "company can insert documents" on public.documents;
create policy "company can insert documents" on public.documents for insert with check (
  public.can_manage_org_documents(organization_id) and uploaded_by=auth.uid()
  and split_part(storage_path,'/',1)=organization_id::text
  and split_part(storage_path,'/',2)=auth.uid()::text
  and storage_path !~ '(^|/)\.\.(/|$)'
  and size_bytes between 1 and 20971520
);
revoke update on public.documents from anon, authenticated;
grant update (status,sent_at,sent_by) on public.documents to authenticated;

create or replace function public.can_manage_org_documents(org uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.is_master_admin() or (public.is_org_member(org) and exists (
    select 1 from public.organization_members m where m.organization_id=org
    and m.user_id=auth.uid() and m.role in ('owner','employee')
  ));
$$;
create or replace function public.can_view_org_document(org uuid, doc_status text)
returns boolean language sql stable security definer set search_path='' as $$
  select public.is_master_admin() or (public.is_org_member(org) and exists (
    select 1 from public.organization_members m where m.organization_id=org and m.user_id=auth.uid()
    and (m.role in ('owner','employee') or (m.role='accountant' and doc_status='sent'))
  ));
$$;
create or replace function public.can_view_org_receipt(org uuid, sent_at timestamptz)
returns boolean language sql stable security definer set search_path='' as $$
  select public.is_master_admin() or (public.is_org_member(org) and exists (
    select 1 from public.organization_members m where m.organization_id=org and m.user_id=auth.uid()
    and (m.role in ('owner','employee') or (m.role='accountant' and sent_at is not null))
  ));
$$;
drop policy if exists "receipt member insert" on public.receipts;
create policy "receipt member insert" on public.receipts for insert with check (
  public.can_manage_org_documents(organization_id) and created_by=auth.uid()
);
drop policy if exists "receipt member update" on public.receipts;
create policy "receipt member update" on public.receipts for update
using(public.can_manage_org_documents(organization_id))
with check(public.can_manage_org_documents(organization_id));
revoke update on public.receipts from anon, authenticated;
grant update (category,note,sent_to_accountant_at,sent_by) on public.receipts to authenticated;

-- Approve and establish access in ONE transaction. The lock prevents double decisions.
create or replace function public.respond_connection_request(
  p_request uuid, p_actor uuid, p_recipient uuid, p_decision text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  req public.connection_requests;
  sender public.organizations;
  recipient public.organizations;
  office public.organizations;
  client public.organizations;
  actor_email text;
  accountant_user uuid;
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
    insert into public.accountant_company(accountant_organization_id,company_id,client_organization_id,status,requested_by,approved_by,approved_at,updated_at)
    values(office.id,client.company_id,client.id,'active',req.sender_user_id,p_actor,now(),now())
    on conflict(accountant_organization_id,company_id) do update set
      client_organization_id=excluded.client_organization_id,status='active',approved_by=p_actor,approved_at=now(),updated_at=now();
    -- Preserve an existing owner/employee role; never downgrade through an upsert.
    for accountant_user in select distinct x.uid from (values (office.owner_user_id),
      (case when recipient.id=office.id then p_actor else null::uuid end)) x(uid) where x.uid is not null loop
      insert into public.organization_members(organization_id,user_id,role)
      values(client.id,accountant_user,'accountant') on conflict(organization_id,user_id) do nothing;
    end loop;
  end if;
  update public.connection_requests set status=case when p_decision='approve' then 'accepted' else 'rejected' end,
    target_organization_id=p_recipient,responded_at=now(),responded_by=p_actor,updated_at=now() where id=p_request;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.respond_connection_request(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.respond_connection_request(uuid,uuid,uuid,text) to service_role;
commit;
