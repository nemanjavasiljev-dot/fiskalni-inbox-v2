import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsUI from "./settings-ui";

export default async function SettingsPage({searchParams}:{searchParams:Promise<{section?:string;org?:string}>}){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const [{data:profile},{data:memberships}]=await Promise.all([
    supabase.from('profiles').select('*').eq('user_id',user.id).single(),
    supabase.from('organization_members').select('organization_id,role,organizations(id,name,pib,registration_number,legal_form,address,municipality,activity_code,activity_name,logo_path,contact_email,contact_phone,organization_type)').eq('user_id',user.id)
  ]);
  if(!profile)redirect('/login');
  const sp=await searchParams;
  const orgs=(memberships||[]).map((m:any)=>({...m.organizations,organization_id:m.organization_id,role:m.role}));
  const activeOrg=(sp.org&&orgs.find((o:any)=>String(o.organization_id)===String(sp.org)))||orgs[0]||null;
  if(!activeOrg)redirect('/app/setup');
  const section=sp.section==='user'?'user':'company';
  return <SettingsUI profile={profile} organization={activeOrg} initialSection={section}/>;
}
