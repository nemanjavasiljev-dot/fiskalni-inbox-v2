import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToAccountantsForClient } from "@/lib/push-delivery";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { organization_id } = await request.json();
  const org = String(organization_id || "");
  const { data: membership } = await supabase.from("organization_members").select("role").eq("organization_id", org).eq("user_id", user.id).maybeSingle();
  if (!membership || membership.role === "accountant") return NextResponse.json({ error: "Nemate pravo slanja računa." }, { status: 403 });

  const admin=createAdminClient();
  const {data:organization,error:organizationError}=await admin.from("organizations").select("receipt_send_schedule").eq("id",org).maybeSingle();
  if(organizationError)return NextResponse.json({error:organizationError.message},{status:400});
  if(organization?.receipt_send_schedule==="weekly"||organization?.receipt_send_schedule==="monthly"){
    const label=organization.receipt_send_schedule==="weekly"?"nedeljno":"mesečno";
    return NextResponse.json({error:`Automatsko ${label} slanje je aktivno. Isključite automatsko slanje da biste slali ručno.`},{status:409});
  }
  const accountantIds=await (async()=>{
    const {data:links}=await admin.from('accountant_company').select('accountant_organization_id').eq('client_organization_id',org).eq('status','active');
    return (links||[]).map((x:any)=>String(x.accountant_organization_id));
  })();
  const { data: legacyAccountant } = await supabase.from("organization_members").select("id").eq("organization_id", org).eq("role", "accountant").limit(1).maybeSingle();
  if (!accountantIds.length && !legacyAccountant) return NextResponse.json({ error: "Firmi još nije dodeljen knjigovođa." }, { status: 400 });

  const sentAt = new Date().toISOString();
  const { data, error } = await supabase.from("receipts")
    .update({ sent_to_accountant_at: sentAt, sent_by: user.id })
    .eq("organization_id", org)
    .is("sent_to_accountant_at", null)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const count=data?.length||0;
  if(count>0){
    const {data:organization}=await admin.from('organizations').select('name').eq('id',org).maybeSingle();
    await sendPushToAccountantsForClient(admin,org,{title:'Novi fiskalni računi',body:`${organization?.name||'Klijent'} je poslao ${count} ${count===1?'račun':'računa'} za prijem.`,url:'/app',tag:`receipts-${org}`}).catch(()=>{});
  }
  return NextResponse.json({ ok: true, sent: count, sent_at: sentAt });
}
