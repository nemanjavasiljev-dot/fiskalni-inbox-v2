begin;
alter table public.subscriptions add column if not exists provider_updated_at timestamptz;
create or replace function public.apply_billing_event(
  p_hash text,p_event text,p_payload jsonb,p_org uuid,
  p_subscription jsonb,p_organization jsonb,p_invoice jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  previous public.subscriptions;
  replacement public.subscriptions;
  inv public.billing_invoices;
  inserted_count integer;
begin
  select * into previous from public.subscriptions where organization_id=p_org for update;
  if not found then raise exception 'Pretplata nije pronađena'; end if;
  insert into public.billing_webhook_events(provider,event_hash,event_name,object_id,payload)
  values('lemonsqueezy',p_hash,p_event,p_payload->'data'->>'id',p_payload)
  on conflict(event_hash) do nothing;
  get diagnostics inserted_count=row_count;
  if inserted_count=0 then return jsonb_build_object('duplicate',true); end if;
  if p_subscription ? 'provider_updated_at' and previous.provider_updated_at is not null
    and (p_subscription->>'provider_updated_at')::timestamptz < previous.provider_updated_at then
    return jsonb_build_object('ignored','stale_event');
  end if;
  select * into replacement from jsonb_populate_record(null::public.subscriptions,to_jsonb(previous)||coalesce(p_subscription,'{}'));
  update public.subscriptions set
    plan=replacement.plan,
    seat_count=replacement.seat_count,
    provider=replacement.provider,
    provider_customer_id=replacement.provider_customer_id,
    provider_subscription_id=replacement.provider_subscription_id,
    provider_variant_id=replacement.provider_variant_id,
    provider_status=replacement.provider_status,
    provider_test_mode=replacement.provider_test_mode,
    status=replacement.status,
    trial_ends_at=replacement.trial_ends_at,
    current_period_end=replacement.current_period_end,
    renews_at=replacement.renews_at,
    ends_at=replacement.ends_at,
    payment_processor=replacement.payment_processor,
    card_brand=replacement.card_brand,
    card_last_four=replacement.card_last_four,
    customer_portal_url=replacement.customer_portal_url,
    update_payment_url=replacement.update_payment_url,
    last_webhook_at=replacement.last_webhook_at,
    activated_at=replacement.activated_at,
    last_payment_at=replacement.last_payment_at,
    provider_updated_at=replacement.provider_updated_at
  where id=previous.id;
  update public.organizations set
    plan=coalesce(p_organization->>'plan',plan),
    status=case when service_blocked_at is not null then status else coalesce(p_organization->>'status',status) end,
    trial_ends_at=case when p_organization ? 'trial_ends_at' then (p_organization->>'trial_ends_at')::timestamptz else trial_ends_at end
  where id=p_org;
  if p_invoice is not null then
    if (p_invoice->>'organization_id')::uuid<>p_org then raise exception 'Neispravan primalac računa'; end if;
    select * into inv from jsonb_populate_record(null::public.billing_invoices,p_invoice);
    insert into public.billing_invoices(organization_id,invoice_number,document_type,plan,quantity,unit_price_net,subtotal_net,vat_rate,vat_amount,total_amount,currency,status,issued_at,paid_at,recipient_name,recipient_pib,recipient_address,recipient_email,issuer_snapshot,provider,provider_invoice_id,external_invoice_url,provider_status,billing_reason,payment_processor,card_brand,card_last_four)
    values(inv.organization_id,inv.invoice_number,inv.document_type,inv.plan,inv.quantity,inv.unit_price_net,inv.subtotal_net,inv.vat_rate,inv.vat_amount,inv.total_amount,inv.currency,inv.status,inv.issued_at,inv.paid_at,inv.recipient_name,inv.recipient_pib,inv.recipient_address,inv.recipient_email,inv.issuer_snapshot,inv.provider,inv.provider_invoice_id,inv.external_invoice_url,inv.provider_status,inv.billing_reason,inv.payment_processor,inv.card_brand,inv.card_last_four)
    on conflict(provider_invoice_id) do update set
      invoice_number=excluded.invoice_number,
      document_type=excluded.document_type,
      plan=excluded.plan,
      quantity=excluded.quantity,
      unit_price_net=excluded.unit_price_net,
      subtotal_net=excluded.subtotal_net,
      vat_rate=excluded.vat_rate,
      vat_amount=excluded.vat_amount,
      total_amount=excluded.total_amount,
      currency=excluded.currency,
      status=excluded.status,
      issued_at=excluded.issued_at,
      paid_at=excluded.paid_at,
      recipient_name=excluded.recipient_name,
      recipient_pib=excluded.recipient_pib,
      recipient_address=excluded.recipient_address,
      recipient_email=excluded.recipient_email,
      issuer_snapshot=excluded.issuer_snapshot,
      provider=excluded.provider,
      external_invoice_url=excluded.external_invoice_url,
      provider_status=excluded.provider_status,
      billing_reason=excluded.billing_reason,
      payment_processor=excluded.payment_processor,
      card_brand=excluded.card_brand,
      card_last_four=excluded.card_last_four;
  end if;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.apply_billing_event(text,text,jsonb,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.apply_billing_event(text,text,jsonb,uuid,jsonb,jsonb,jsonb) to service_role;
commit;
