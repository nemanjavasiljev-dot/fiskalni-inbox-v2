import { NextResponse } from "next/server";
import { requireMaster } from "@/lib/master-auth";
export async function POST(request:Request){
  const ctx=await requireMaster();if(!ctx.ok)return NextResponse.json({error:ctx.error},{status:ctx.status});
  const {membership_id,access_role}=await request.json();
  if(!membership_id||!["admin","user"].includes(access_role))return NextResponse.json({error:"Neispravna privilegija."},{status:400});
  const {data:m,error:readError}=await ctx.admin.from("organization_members").select("id,organization_id,user_id,role,organizations(organization_type,owner_user_id)").eq("id",membership_id).maybeSingle();
  if(readError||!m)return NextResponse.json({error:"Član nije pronađen."},{status:404});
  const org:any=(m as any).organizations;if(org?.organization_type!=="accounting")return NextResponse.json({error:"Privilegija važi samo za knjigovodstvenu agenciju."},{status:400});
  if(String(org.owner_user_id)===String(m.user_id)&&access_role!=="admin")return NextResponse.json({error:"Vlasnik agencije mora ostati admin."},{status:400});
  const {error}=await ctx.admin.from("organization_members").update({accounting_access_role:access_role}).eq("id",membership_id);if(error)return NextResponse.json({error:error.message},{status:400});
  await ctx.admin.from("master_action_log").insert({action:"accounting_role_changed",organization_id:m.organization_id,target_user_id:m.user_id,details:{access_role},created_by:ctx.user.id});
  return NextResponse.json({ok:true});
}
