import { NextResponse } from "next/server";
import { requireMaster } from "@/lib/master-auth";
import { createPlanProforma } from "@/lib/billing";

export async function POST(request:Request){
  const ctx=await requireMaster();if(!ctx.ok)return NextResponse.json({error:ctx.error},{status:ctx.status});
  const body=await request.json();
  const organizationId=String(body.organization_id||"");
  const plan=body.plan==="premium"?"premium":"basic";
  const qty=Math.max(1,Number(body.quantity||1));
  if(!organizationId)return NextResponse.json({error:"Izaberite klijenta."},{status:400});
  if(body.document_type==="invoice")return NextResponse.json({error:"Finalni račun se ne izdaje ručno pre verifikacije uplate. Kreirajte predračun, zatim verifikujte uplatu u delu Banka / uplate."},{status:400});
  const {data:org}=await ctx.admin.from("organizations").select("*").eq("id",organizationId).maybeSingle();
  if(!org)return NextResponse.json({error:"Klijent nije pronađen."},{status:404});
  let email=String(body.recipient_email||org.contact_email||"");
  if(!email){const {data:p}=await ctx.admin.from("profiles").select("auth_email").eq("user_id",org.owner_user_id).maybeSingle();email=p?.auth_email||"";}
  try{
    const created=await createPlanProforma({admin:ctx.admin,organization:org,plan,seats:qty,recipientEmail:email,appBillingUrl:`${new URL(request.url).origin}/app/billing`});
    await ctx.admin.from("master_action_log").insert({action:"billing_proforma_created",organization_id:organizationId,details:{invoice_id:created.invoice?.id,plan,quantity:qty,email_sent:Boolean(created.email?.sent)},created_by:ctx.user.id});
    return NextResponse.json({ok:true,invoice:created.invoice,email:created.email,reused:created.reused,message:created.reused?'Postojeći neplaćeni predračun je ponovo poslat.':'Predračun je kreiran i dodat u Neplaćeno.'});
  }catch(e:any){return NextResponse.json({error:e?.message||'Predračun nije kreiran.'},{status:400});}
}
