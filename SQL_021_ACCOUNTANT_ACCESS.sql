begin;
-- Membership alone is not sufficient after an accounting relationship is blocked.
create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.is_master_admin() or (
    public.organization_service_available(org)
    and exists (
      select 1 from public.organization_members m
      where m.organization_id=org and m.user_id=auth.uid()
        and (m.role in ('owner','employee') or (
          m.role='accountant' and exists (
            select 1 from public.accountant_company ac
            join public.organization_members om on om.organization_id=ac.accountant_organization_id
            where ac.client_organization_id=org and ac.status='active'
              and om.user_id=auth.uid() and om.role in ('owner','employee')
              and public.organization_service_available(ac.accountant_organization_id)
              and (om.role='owner' or om.accounting_access_role='admin' or exists (
                select 1 from public.accountant_client_assignments a
                where a.accounting_organization_id=ac.accountant_organization_id
                  and a.client_organization_id=org and a.employee_user_id=auth.uid()
              ))
          )
        ))
    )
  );
$$;
-- Office administrators with explicit client membership can view that client;
-- regular staff additionally need a current assignment.
commit;
