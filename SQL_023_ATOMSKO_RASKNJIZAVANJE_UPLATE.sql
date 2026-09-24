begin;

-- Jedan predračun može proizvesti najviše jedan finalni račun.
create unique index if not exists uq_billing_invoice_source_proforma
  on public.billing_invoices(source_proforma_id)
  where source_proforma_id is not null and document_type='invoice';

create or replace function public.settle_bank_proforma(
  p_proforma uuid,
  p_bank_transaction uuid default null,
  p_verified_by uuid default null,
  p_source text default 'MASTER_RUCNA_VERIFIKACIJA',
  p_paid_at timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  proforma public.billing_invoices%rowtype;
  existing_invoice public.billing_invoices%rowtype;
  final_invoice public.billing_invoices%rowtype;
  bank_tx public.bank_transactions%rowtype;
  invoice_number text;
  period_start date;
  period_end date;
  v_source text;
begin
  select * into proforma
  from public.billing_invoices
  where id=p_proforma
  for update;

  if not found then raise exception 'Predračun nije pronađen'; end if;
  if proforma.document_type<>'proforma' then raise exception 'Dokument nije predračun'; end if;

  select * into existing_invoice
  from public.billing_invoices
  where source_proforma_id=proforma.id and document_type='invoice'
  limit 1;

  if found then
    return jsonb_build_object('invoice',to_jsonb(existing_invoice),'alreadySettled',true);
  end if;

  if proforma.status not in ('unpaid','converted') then
    raise exception 'Predračun nije otvoren za rasknjižavanje';
  end if;

  v_source := left(coalesce(nullif(p_source,''),'MASTER_RUCNA_VERIFIKACIJA'),80);
  period_start := p_paid_at::date;
  period_end := (p_paid_at::date + interval '1 month')::date;

  if p_bank_transaction is not null then
    select * into bank_tx
    from public.bank_transactions
    where id=p_bank_transaction
    for update;

    if not found then raise exception 'Bankarska transakcija nije pronađena'; end if;
    if bank_tx.status='matched' then raise exception 'Bankarska transakcija je već rasknjižena'; end if;
    if bank_tx.direction<>'credit' then raise exception 'Samo priliv može verifikovati uplatu'; end if;
    if upper(coalesce(bank_tx.currency,'RSD'))<>'RSD' then raise exception 'Valuta uplate nije RSD'; end if;
    if abs(coalesce(bank_tx.amount,0)-coalesce(proforma.total_amount,0))>=0.01 then
      raise exception 'Iznos uplate ne odgovara predračunu';
    end if;
  end if;

  invoice_number := public.next_billing_document_number('invoice');

  insert into public.billing_invoices(
    organization_id,company_id,invoice_number,document_type,plan,quantity,
    unit_price_net,subtotal_net,vat_rate,vat_amount,total_amount,currency,status,
    issued_at,paid_at,recipient_name,recipient_pib,recipient_registration_number,
    recipient_address,recipient_email,issuer_snapshot,provider,payment_reference,
    source_proforma_id,bank_transaction_id,verification_source,verified_at,
    service_period_start,service_period_end,note
  ) values (
    proforma.organization_id,proforma.company_id,invoice_number,'invoice',proforma.plan,proforma.quantity,
    proforma.unit_price_net,proforma.subtotal_net,0,0,proforma.total_amount,coalesce(proforma.currency,'RSD'),'paid',
    p_paid_at,p_paid_at,proforma.recipient_name,proforma.recipient_pib,proforma.recipient_registration_number,
    proforma.recipient_address,proforma.recipient_email,proforma.issuer_snapshot,'bank_transfer',proforma.payment_reference,
    proforma.id,p_bank_transaction,v_source,now(),period_start,period_end,
    'Finalni račun po predračunu '||proforma.invoice_number||'. Uplata verifikovana u FiscalBox sistemu.'
  ) returning * into final_invoice;

  update public.billing_invoices
  set status='converted',paid_at=p_paid_at,verified_at=now(),
      verification_source=v_source,bank_transaction_id=p_bank_transaction
  where id=proforma.id;

  update public.subscriptions
  set plan=proforma.plan,
      seat_count=proforma.quantity,
      provider='bank_transfer',
      status='active',
      activated_at=coalesce(activated_at,p_paid_at),
      last_payment_at=p_paid_at,
      current_period_end=period_end::timestamptz,
      renews_at=period_end::timestamptz,
      provider_status='paid',
      payment_processor=case when p_bank_transaction is null then 'manual_bank_verification' else 'bank_api' end,
      provider_updated_at=greatest(coalesce(provider_updated_at,'epoch'::timestamptz),p_paid_at)
  where organization_id=proforma.organization_id;

  -- Plaćanje ne sme automatski ukloniti eksplicitnu MASTER suspenziju.
  update public.organizations
  set plan=proforma.plan,
      status=case when service_blocked_at is null then 'active' else status end,
      service_block_reason=case when service_blocked_at is null then null else service_block_reason end
  where id=proforma.organization_id;

  if p_bank_transaction is not null then
    update public.bank_transactions
    set status='matched',matched_invoice_id=final_invoice.id,
        matched_organization_id=proforma.organization_id,
        verified_by=p_verified_by,verified_at=now(),updated_at=now()
    where id=p_bank_transaction;
  end if;

  return jsonb_build_object('invoice',to_jsonb(final_invoice),'alreadySettled',false);
end;
$$;

revoke all on function public.settle_bank_proforma(uuid,uuid,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.settle_bank_proforma(uuid,uuid,uuid,text,timestamptz) to service_role;

commit;
