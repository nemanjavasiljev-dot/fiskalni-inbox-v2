import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request:Request){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Niste prijavljeni.'},{status:401});
  const {accounting_organization_id,employee_user_id,client_ids}=await request.json();
  const officeId=String(accounting_organization_id||'');const employeeId=String(employee_user_id||'');
  const clients:string[]=Array.isArray(client_ids)?Array.from(new Set<string>((client_ids as unknown[]).map((x)=>String(x)).filter(Boolean))):[];
  const {data:membership}=await supabase.from('organization_members').select('accounting_access_role,organizations(owner_user_id,organization_type)').eq('organization_id',officeId).eq('user_id',user.id).maybeSingle();
  const office:any=(membership as any)?.organizations;
  const isAdmin=office?.organization_type==='accounting'&&(office?.owner_user_id===user.id||(membership as any)?.accounting_access_role==='admin');
  if(!isAdmin)return NextResponse.json({error:'Samo admin može dodeljivati klijente.'},{status:403});
  const admin=createAdminClient();
  const {data:employeeMembership}=await admin.from('organization_members').select('role').eq('organization_id',officeId).eq('user_id',employeeId).maybeSingle();
  if(employeeMembership?.role!=='employee')return NextResponse.json({error:'Izabrani korisnik nije zaposleni ove agencije.'},{status:400});
  const {data:old}=await admin.from('accountant_client_assignments').select('client_organization_id').eq('accounting_organization_id',officeId).eq('employee_user_id',employeeId);
  const oldIds=(old||[]).map((x:any)=>String(x.client_organization_id));
  const removeIds:string[]=oldIds.filter((id:string)=>!clients.includes(id));
  if(removeIds.length){
    await admin.from('accountant_client_assignments').delete().eq('accounting_organization_id',officeId).eq('employee_user_id',employeeId).in('client_organization_id',removeIds);
    for(const id of removeIds)await admin.from('organization_members').delete().eq('organization_id',id).eq('user_id',employeeId).eq('role','accountant');
  }
  for(const clientId of clients){
    await admin.from('organization_members').upsert({organization_id:clientId,user_id:employeeId,role:'accountant'},{onConflict:'organization_id,user_id'});
    await admin.from('accountant_client_assignments').upsert({accounting_organization_id:officeId,employee_user_id:employeeId,client_organization_id:clientId,assigned_by:user.id},{onConflict:'accounting_organization_id,employee_user_id,client_organization_id'});
  }
  return NextResponse.json({ok:true,client_ids:clients});
}
