import { NextResponse } from "next/server";
import { requireMaster } from "@/lib/master-auth";
function monthStart(){const d=new Date();return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1));}
function monthEndDate(){const d=new Date();return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).toISOString().slice(0,10);}
export async function POST(){
  const ctx=await requireMaster();if(!ctx.ok)return NextResponse.json({error:ctx.error},{status:ctx.status});
  const [{data:orgs},{data:members},{data:profiles}]=await Promise.all([
    ctx.admin.from("organizations").select("id,plan,organization_type,owner_user_id"),
    ctx.admin.from("organization_members").select("organization_id,user_id,role"),
    ctx.admin.from("profiles").select("user_id,global_role")
  ]);
  const allOrgs:any[]=orgs||[];const allMembers:any[]=members||[];
  const companies=allOrgs.filter((o:any)=>o.organization_type!=="accounting");const offices=allOrgs.filter((o:any)=>o.organization_type==="accounting");
  const companyMap:Map<string,any>=new Map(companies.map((o:any)=>[String(o.id),o]));const usersPerOrg=new Map<string,number>();
  for(const o of companies){const seats=allMembers.filter((m:any)=>String(m.organization_id)===String(o.id)&&["owner","employee"].includes(m.role)).length;usersPerOrg.set(String(o.id),Math.max(1,seats));}
  const groups:Array<{recipient:string;officeId:string|null;memberIds:string[]}>=[];const groupedUsers=new Set<string>();
  for(const office of offices){const memberIds=allMembers.filter((m:any)=>String(m.organization_id)===String(office.id)&&["owner","employee"].includes(m.role)).map((m:any)=>String(m.user_id));memberIds.forEach(id=>groupedUsers.add(id));groups.push({recipient:String(office.owner_user_id),officeId:String(office.id),memberIds});}
  const standalone: string[] = Array.from(new Set<string>([...allMembers.filter((m:any)=>m.role==="accountant").map((m:any)=>String(m.user_id)),...(profiles||[]).filter((p:any)=>p.global_role==="accountant").map((p:any)=>String(p.user_id))])).filter(id=>!groupedUsers.has(id));
  standalone.forEach(id=>groups.push({recipient:id,officeId:null,memberIds:[id]}));
  let count=0;for(const g of groups){const clientOrgIds: string[] = Array.from(new Set<string>(allMembers.filter((m:any)=>m.role==="accountant"&&g.memberIds.includes(String(m.user_id))).map((m:any)=>String(m.organization_id))));let appUsers=0;for(const orgId of clientOrgIds){const o:any=companyMap.get(orgId);if(o&&o.plan!=="trial")appUsers+=usersPerOrg.get(orgId)||1;}
    const period=monthStart().toISOString().slice(0,10);const payload={accountant_user_id:g.recipient,accounting_organization_id:g.officeId,period_month:period,app_users_count:appUsers,base_amount:appUsers*250,status:"pending",due_at:monthEndDate(),created_by:ctx.user.id};
    const {error}=await ctx.admin.from("accountant_payouts").upsert(payload,{onConflict:"accountant_user_id,period_month"});if(!error)count++;
  }
  return NextResponse.json({ok:true,count});
}
