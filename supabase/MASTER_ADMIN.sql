-- Prvo kreirajte i potvrdite sopstveni korisnički nalog u Supabase Auth.
-- Zamenite email ispod stvarnim emailom administratora. Nema podrazumevane lozinke.
-- Pokrenite samo u Supabase SQL Editoru kao vlasnik projekta.
begin;
do $$ begin
  if not exists(select 1 from auth.users where email='ZAMENITE_SVOJIM_EMAILOM' and email_confirmed_at is not null)
  then raise exception 'Unesite email postojećeg potvrđenog naloga pre pokretanja.'; end if;
end $$;
update public.profiles set global_role='master_admin'
where user_id=(select id from auth.users where email='ZAMENITE_SVOJIM_EMAILOM' and email_confirmed_at is not null);
commit;
