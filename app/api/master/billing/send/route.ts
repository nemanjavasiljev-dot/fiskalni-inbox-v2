import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireMaster } from "@/lib/master-auth";
import { buildBillingPdf } from "@/lib/simple-pdf";
import { sendBillingInvoiceEmail } from "@/lib/mailer";

export async function POST(request:Request){
  const ctx=await requireMaster();if(!ctx.ok)return NextResponse.json({error:ctx.error},{status:ctx.status});
  const body=await request.json();const organizationId=String(body.organization_id||"");const type=body.document_type==="invoice"?"invoice":"proforma";const plan=body.plan==="premium"?"premium":"basic";const qty=Math.max(1,Number(body.quantity||1));const unit=Math.max(0,Number(body.unit_price_net||0));
  if(!organizationId||!unit)return NextResponse.json({error:"Izaberite klijenta i unesite cenu bez PDV."},{status:400});
  const {data:org}=await ctx.admin.from("organizations").select("*").eq("id",organizationId).maybeSingle();if(!org)return NextResponse.json({error:"Klijent nije pronađen."},{status:404});
  const {data:issuer}=await ctx.admin.from("billing_issuer_settings").select("*").eq("active",true).eq("is_demo",false).order("created_at").limit(1).maybeSingle();
  if(!issuer)return NextResponse.json({error:"Produkcioni izdavalac nije podešen. Unesite stvarne podatke izdavaoca u billing_issuer_settings i aktivirajte ga."},{status:409});
  const subtotal=unit*qty;const vatRate=Number(issuer.vat_rate??20);const vat=Math.round(subtotal*vatRate)/100;const total=subtotal+vat;const prefix=type==="invoice"?"R":"P";const number=`FB-${prefix}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${randomUUID().slice(0,6).toUpperCase()}`;
  let email=String(body.recipient_email||org.contact_email||"");if(!email){const {data:p}=await ctx.admin.from("profiles").select("auth_email").eq("user_id",org.owner_user_id).maybeSingle();email=p?.auth_email||"";}
  const payload:any={organization_id:organizationId,company_id:org.company_id||null,invoice_number:number,document_type:type,plan,quantity:qty,unit_price_net:unit,subtotal_net:subtotal,vat_rate:vatRate,vat_amount:vat,total_amount:total,currency:"RSD",status:"unpaid",issued_at:new Date().toISOString(),due_at:body.due_at||null,recipient_name:org.name,recipient_pib:org.pib||null,recipient_address:org.address||null,recipient_email:email||null,issuer_snapshot:issuer,note:String(body.note||"")||null,provider:"manual"};
  const {data:invoice,error}=await ctx.admin.from("billing_invoices").insert(payload).select("*").single();if(error)return NextResponse.json({error:error.message},{status:400});
  let emailResult:any={sent:false,configured:false};if(email){emailResult=await sendBillingInvoiceEmail({to:email,organizationName:org.name,invoiceNumber:number,plan,totalAmount:total,billingUrl:`${new URL(request.url).origin}/app/billing`,pdf:buildBillingPdf(invoice)});if(emailResult.sent)await ctx.admin.from("billing_invoices").update({emailed_at:new Date().toISOString()}).eq("id",invoice.id);}
  await ctx.admin.from("master_action_log").insert({action:"billing_document_created",organization_id:organizationId,details:{invoice_id:invoice.id,document_type:type,total,email_sent:Boolean(emailResult.sent)},created_by:ctx.user.id});
  return NextResponse.json({ok:true,invoice,email:emailResult});
}
