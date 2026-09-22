import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import AccountantSettings from './settings-ui';

export default async function AccountantSettingsPage({searchParams}:{searchParams:Promise<{tab?:string}>}){
  const sp=await searchParams;
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('*').eq('user_id',user.id).single();
  const {data:officeMemberships}=await supabase.from('organization_members').select('organization_id,role,accounting_access_role,organizations(id,name,pib,logo_path,owner_user_id,organization_type,status)').eq('user_id',user.id).in('role',['owner','employee']);
  const officeMembership:any=(officeMemberships||[]).find((m:any)=>m.organizations?.organization_type==='accounting');
  if(!officeMembership)redirect('/app');
  const office:any={organization_id:officeMembership.organization_id,role:officeMembership.role,accounting_access_role:officeMembership.accounting_access_role,...officeMembership.organizations};
  const isAdmin=(office.role==='owner'&&office.owner_user_id===user.id)||office.accounting_access_role==='admin';
  const {data:settings}=await supabase.from('accountant_user_settings').select('*').eq('user_id',user.id).eq('accounting_organization_id',office.organization_id).maybeSingle();
  let staff:any[]=[];let clients:any[]=[];let assignments:any[]=[];
  if(isAdmin){
    const {data:sm}=await supabase.from('organization_members').select('user_id,role,accounting_access_role').eq('organization_id',office.organization_id).in('role',['owner','employee']);
    const ids=(sm||[]).map((x:any)=>x.user_id);
    const admin=createAdminClient();
    const {data:profiles}=ids.length?await admin.from('profiles').select('user_id,username,full_name,auth_email,created_at').in('user_id',ids):{data:[] as any[]};
    const roles=new Map((sm||[]).map((x:any)=>[String(x.user_id),x.role]));
    const access=new Map((sm||[]).map((x:any)=>[String(x.user_id),x.accounting_access_role]));
    staff=(profiles||[]).map((p:any)=>({...p,office_role:roles.get(String(p.user_id)),accounting_access_role:access.get(String(p.user_id))}));
    const {data:clientMemberships}=await supabase.from('organization_members').select('organization_id,organizations(id,name,pib,logo_path)').eq('user_id',user.id).eq('role','accountant');
    clients=(clientMemberships||[]).map((m:any)=>({organization_id:m.organization_id,...m.organizations}));
    const {data:rows}=await supabase.from('accountant_client_assignments').select('employee_user_id,client_organization_id').eq('accounting_organization_id',office.organization_id);
    assignments=rows||[];
  }
  return <AccountantSettings profile={profile} office={office} isAdmin={isAdmin} initialSettings={settings||{notify_new_receipts:true,notify_new_documents:true,notify_deadlines:true}} staff={staff} clients={clients} assignments={assignments} initialTab={sp.tab||'profile'}/>;
}
