import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normEmail(value:any){return String(value||"").trim().toLowerCase();}

export async function GET(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Niste prijavljeni."},{status:401});

  const {data:profile}=await supabase.from("profiles").select("auth_email").eq("user_id",user.id).maybeSingle();
  const {data:memberships}=await supabase
    .from("organization_members")
    .select("organization_id,role,accounting_access_role,organizations(id,name,organization_type,owner_user_id)")
    .eq("user_id",user.id);

  const rows=(memberships||[]).map((m:any)=>({
    organization_id:m.organization_id,
    role:m.role,
    accounting_access_role:m.accounting_access_role,
    ...(m.organizations||{})
  }));
  const office:any=rows.find((o:any)=>o.organization_type==="accounting"&&(o.role==="owner"||o.role==="employee"));
  // V5.9.4.3: fiskalni računi i dokumenti nisu notifikacioni događaji za KNJIGOVOĐU.
  // Oni ostaju dostupni u prijemu i u dashboard brojačima.

  let connectionRequests:any[]=[];
  if(office){
    const admin=createAdminClient();
    const now=new Date().toISOString();
    const email=normEmail(profile?.auth_email||user.email||"");
    const base=()=>admin.from("connection_requests").select("*").eq("target_kind","accounting").eq("status","pending").gt("expires_at",now).order("created_at",{ascending:false}).limit(100);
    const [direct,byEmail]=await Promise.all([
      base().eq("target_organization_id",String(office.organization_id)),
      email?base().is("target_organization_id",null).eq("channel","email").eq("recipient_email",email):Promise.resolve({data:[] as any[]} as any)
    ]);
    const merged=[...(direct.data||[]),...(byEmail.data||[])];
    const dedup=new Map<string,any>();
    for(const item of merged)dedup.set(String(item.id),item);
    connectionRequests=Array.from(dedup.values());
    const senderIds=Array.from(new Set(connectionRequests.map((r:any)=>String(r.sender_organization_id)).filter(Boolean)));
    const {data:senders}=senderIds.length?await admin.from("organizations").select("id,name,pib").in("id",senderIds):{data:[] as any[]};
    const senderMap=new Map((senders||[]).map((o:any)=>[String(o.id),o]));
    connectionRequests=connectionRequests.map((r:any)=>({...r,sender_organization:senderMap.get(String(r.sender_organization_id))||null}));
  }

  const items:any[]=[];
  const signature=JSON.stringify({c:connectionRequests.map((x:any)=>String(x.id))});

  return NextResponse.json({
    ok:true,
    checked_at:new Date().toISOString(),
    count:connectionRequests.length,
    connection_requests:connectionRequests,
    items,
    signature
  },{headers:{"Cache-Control":"private, no-store, max-age=0"}});
}
