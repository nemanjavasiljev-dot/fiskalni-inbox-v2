begin;
-- Serialize new workspace creation per legal entity, without destroying old duplicates.
create or replace function public.guard_company_workspace_creation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.company_id is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.company_id::text,0));
  if exists(select 1 from public.organizations where company_id=new.company_id and id<>new.id) then
    raise exception 'Firma već ima FiscalBox nalog. Zatražite pristup.' using errcode='23505';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_company_workspace_creation on public.organizations;
create trigger guard_company_workspace_creation before insert on public.organizations
for each row execute function public.guard_company_workspace_creation();
-- Keep the profile email in sync after a confirmed auth email change.
create or replace function public.sync_auth_profile_email()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.profiles set auth_email=new.email,updated_at=now() where user_id=new.id;
  return new;
end;
$$;
drop trigger if exists sync_auth_profile_email on auth.users;
create trigger sync_auth_profile_email after update of email on auth.users
for each row when (old.email is distinct from new.email) execute function public.sync_auth_profile_email();
create or replace function public.normalize_company_name(value text)
returns text
language sql immutable
as $$
  select trim(regexp_replace(
    translate(
      replace(replace(replace(replace(replace(replace(lower(coalesce(value,'')), 'đ','dj'), 'љ','lj'), 'њ','nj'), 'џ','dz'), 'ђ','dj'), 'ћ','c'),
      'абвгдежзијклмнопрстуфхцчшčćžšđ',
      'abvgdezzijklmnoprstufhccscczsd'
    ),
    '[^a-z0-9]+',' ','g'
  ));
$$;
update public.companies set normalized_name=public.normalize_company_name(name)
where normalized_name is distinct from public.normalize_company_name(name);
commit;
