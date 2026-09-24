function unique(values:any[]){return Array.from(new Set((values||[]).map(v=>String(v||"")).filter(Boolean)));}

export async function allowedMessageRecipients(admin:any,userId:string){
  const {data:profile}=await admin.from("profiles").select("user_id,username,full_name,auth_email,global_role").eq("user_id",userId).maybeSingle();
  if(profile?.global_role==="master_admin"){
    const {data:all}=await admin.from("profiles").select("user_id,username,full_name,auth_email,global_role").neq("user_id",userId).limit(5000);
    return (all||[]).map((p:any)=>({user_id:String(p.user_id),label:p.full_name||p.username||p.auth_email||"Korisnik",email:p.auth_email||"",kind:p.global_role||"user"}));
  }

  const {data:memberships}=await admin.from("organization_members")
    .select("organization_id,role,accounting_access_role,organizations(id,name,organization_type)")
    .eq("user_id",userId);
  const rows=(memberships||[]) as any[];
  const companyOrgIds=unique(rows.filter((m:any)=>m.organizations?.organization_type!=="accounting"&&["owner","employee"].includes(String(m.role))).map((m:any)=>m.organization_id));
  const accountingOrgIds=unique(rows.filter((m:any)=>m.organizations?.organization_type==="accounting"&&["owner","employee"].includes(String(m.role))).map((m:any)=>m.organization_id));
  const legacyClientOrgIds=unique(rows.filter((m:any)=>String(m.role)==="accountant").map((m:any)=>m.organization_id));
  const recipientIds:string[]=[];
  const orgLabels=new Map<string,string>();

  if(companyOrgIds.length){
    const {data:legacyAcc}=await admin.from("organization_members").select("user_id,organization_id").in("organization_id",companyOrgIds).eq("role","accountant");
    recipientIds.push(...(legacyAcc||[]).map((m:any)=>String(m.user_id)));
    const {data:links}=await admin.from("accountant_company").select("accountant_organization_id,client_organization_id").in("client_organization_id",companyOrgIds).eq("status","active");
    const officeIds=unique((links||[]).map((x:any)=>x.accountant_organization_id));
    if(officeIds.length){
      const {data:officeMembers}=await admin.from("organization_members").select("user_id,organization_id,organizations(name)").in("organization_id",officeIds).in("role",["owner","employee"]);
      for(const m of officeMembers||[]){recipientIds.push(String(m.user_id));if(m.organizations?.name)orgLabels.set(String(m.user_id),String(m.organizations.name));}
    }
  }

  if(accountingOrgIds.length||legacyClientOrgIds.length){
    const clientIds=[...legacyClientOrgIds];
    if(accountingOrgIds.length){
      const {data:links}=await admin.from("accountant_company").select("client_organization_id,accountant_organization_id").in("accountant_organization_id",accountingOrgIds).eq("status","active");
      clientIds.push(...(links||[]).map((x:any)=>String(x.client_organization_id)));
    }
    const uniqueClients=unique(clientIds);
    if(uniqueClients.length){
      const {data:clientMembers}=await admin.from("organization_members").select("user_id,organization_id,organizations(name)").in("organization_id",uniqueClients).in("role",["owner","employee"]);
      for(const m of clientMembers||[]){recipientIds.push(String(m.user_id));if(m.organizations?.name)orgLabels.set(String(m.user_id),String(m.organizations.name));}
    }
  }

  const {data:masters}=await admin.from("profiles").select("user_id").eq("global_role","master_admin");
  recipientIds.push(...(masters||[]).map((p:any)=>String(p.user_id)));
  const ids=unique(recipientIds).filter((id:string)=>id!==String(userId));
  if(!ids.length)return [];
  const {data:profiles}=await admin.from("profiles").select("user_id,username,full_name,auth_email,global_role").in("user_id",ids);
  return (profiles||[]).map((p:any)=>({
    user_id:String(p.user_id),
    label:orgLabels.get(String(p.user_id))||p.full_name||p.username||p.auth_email||"Korisnik",
    person:p.full_name||p.username||"",
    email:p.auth_email||"",
    kind:p.global_role||"user"
  })).sort((a:any,b:any)=>String(a.label).localeCompare(String(b.label),"sr"));
}
