import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Dashboard from "./ui";
import SubscriptionRequired from "@/components/SubscriptionRequired";

function normEmail(v:any){return String(v||'').trim().toLowerCase();}
function normPhone(v:any){let d=String(v||'').replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if(d.startsWith('0'))d=`381${d.slice(1)}`;if(d&&!d.startsWith('381')&&d.length<=10)d=`381${d}`;return d?`+${d}`:'';}
async function loadIncomingConnections(admin:any,targetKind:'company'|'accounting',org:any,userEmail:string){
  if(!org)return [];
  if(org.role && !(org.role==='owner'||org.accounting_access_role==='admin'))return [];
  const orgId=String(org.organization_id||org.id||'');
  const base=()=>admin.from('connection_requests').select('*').eq('target_kind',targetKind).eq('status','pending').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(100);
  const [direct,byEmail]=await Promise.all([
    base().eq('target_organization_id',orgId),
    base().is('target_organization_id',null).eq('channel','email').eq('recipient_email',normEmail(userEmail))
  ]);
  const matched=[...(direct.data||[]),...(byEmail.data||[])];
  const senderIds=Array.from(new Set(matched.map((r:any)=>String(r.sender_organization_id)).filter(Boolean)));
  const {data:senders}=senderIds.length?await admin.from('organizations').select('id,name,pib,organization_type').in('id',senderIds):{data:[] as any[]};
  const senderMap=new Map((senders||[]).map((o:any)=>[String(o.id),o]));
  return matched.map((r:any)=>({...r,sender_organization:senderMap.get(String(r.sender_organization_id))||null}));
}

export default async function AppPage({searchParams}:{searchParams:Promise<{org?:string}>}) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data:{user} } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data:profile } = await supabase.from("profiles").select("*").eq("user_id",user.id).single();
  if (!profile) redirect("/login");

  const { data:memberships } = await supabase
    .from("organization_members")
    .select("id,organization_id,role,accounting_access_role,organizations(id,company_id,name,pib,registration_number,legal_form,address,municipality,activity_code,activity_name,plan,status,organization_type,trial_ends_at,accountant_pib_pending,accountant_contact_email,logo_path,receipt_send_schedule,last_auto_receipt_send_at,owner_user_id,contact_email,contact_phone,service_block_reason,service_blocked_at)")
    .eq("user_id",user.id);

  const params = await searchParams;
  const rawOrgs = (memberships||[]).map((m:any)=>({organization_id:m.organization_id,role:m.role,accounting_access_role:m.accounting_access_role,...m.organizations}));
  const membershipOrgIds=rawOrgs.map((o:any)=>o.organization_id);
  const {data:subscriptionRows}=membershipOrgIds.length?await supabase.from("subscriptions").select("*").in("organization_id",membershipOrgIds):{data:[] as any[]};
  const subscriptionMap=new Map((subscriptionRows||[]).map((sub:any)=>[String(sub.organization_id),sub]));
  const orgs = rawOrgs.map((o:any)=>({...o,subscription:subscriptionMap.get(String(o.organization_id))||null}));
  const activeOrg = params.org ? orgs.find((x:any)=>x.organization_id===params.org) : orgs[0];
  const activeCompanyConnectionRequests=activeOrg&&activeOrg.organization_type!=='accounting'&&activeOrg.role!=='accountant'?await loadIncomingConnections(admin,'company',activeOrg,profile.auth_email||user.email||''):[];

  const {data:ownPendingAccess}=await supabase.from('company_access_requests')
    .select('id,company_id,organization_id,status,created_at,organizations(name,pib)')
    .eq('requester_user_id',user.id).eq('status','pending').order('created_at',{ascending:false}).limit(10);
  let incomingAccessRequests:any[]=[];
  let incomingAccountantRequests:any[]=[];
  if(activeOrg?.company_id && activeOrg?.role==='owner'){
    const [{data:accessRows},{data:accountantRows}]=await Promise.all([
      supabase.from('company_access_requests').select('id,company_id,organization_id,requester_user_id,requested_role,status,created_at').eq('company_id',activeOrg.company_id).eq('status','pending').neq('requester_user_id',user.id).order('created_at',{ascending:false}),
      supabase.from('accountant_company').select('id,accountant_organization_id,company_id,status,created_at').eq('company_id',activeOrg.company_id).eq('status','pending').order('created_at',{ascending:false})
    ]);
    const requesterIds=Array.from(new Set((accessRows||[]).map((x:any)=>x.requester_user_id)));
    const officeIds=Array.from(new Set((accountantRows||[]).map((x:any)=>x.accountant_organization_id)));
    const [{data:requesterProfiles},{data:accountingOffices}]=await Promise.all([
      requesterIds.length?admin.from('profiles').select('user_id,username,full_name,auth_email').in('user_id',requesterIds):Promise.resolve({data:[] as any[]} as any),
      officeIds.length?admin.from('organizations').select('id,name,pib,company_id').in('id',officeIds):Promise.resolve({data:[] as any[]} as any)
    ]);
    const requesterMap=new Map((requesterProfiles||[]).map((x:any)=>[String(x.user_id),x]));
    const officeMap=new Map((accountingOffices||[]).map((x:any)=>[String(x.id),x]));
    incomingAccessRequests=(accessRows||[]).map((x:any)=>({...x,requester:requesterMap.get(String(x.requester_user_id))||null}));
    incomingAccountantRequests=(accountantRows||[]).map((x:any)=>({...x,accounting_organization:officeMap.get(String(x.accountant_organization_id))||null}));
  }
  const accessContext={ownPending:ownPendingAccess||[],incomingAccessRequests,incomingAccountantRequests,incomingConnectionRequests:activeCompanyConnectionRequests};

  let accountantOverview:any = null;
  let accountantContext:any = null;
  const accountantOrgs = orgs.filter((o:any)=>o.role === "accountant");
  const accountingOffice:any = orgs.find((o:any)=>o.organization_type === "accounting" && (o.role === "owner" || o.role === "employee"));
  const accountantOnly = profile.global_role === "accountant" && profile.global_role !== "master_admin";
  if (accountantOnly) {
    const orgIds = accountantOrgs.map((o:any)=>o.organization_id);
    if (orgIds.length > 0) {
      const [{data:allReceipts},{data:allDocuments},{data:receiptStatuses},{data:documentStatuses}] = await Promise.all([
        supabase.from("receipts").select("id,organization_id,merchant_name,merchant_pib,invoice_number,sdc_time,total_amount,total_tax,category,sent_to_accountant_at,created_at,vat_deductible,vat_decided_at,ai_vat_recommendation,ai_vat_confidence").in("organization_id",orgIds).not("sent_to_accountant_at","is",null).order("sent_to_accountant_at",{ascending:false}).limit(2000),
        supabase.from("documents").select("id,organization_id,file_name,mime_type,size_bytes,source,status,sent_at,created_at").in("organization_id",orgIds).eq("status","sent").order("sent_at",{ascending:false}).limit(2000),
        supabase.from("accountant_receipt_status").select("*").eq("accountant_user_id",user.id),
        supabase.from("accountant_document_status").select("*").eq("accountant_user_id",user.id)
      ]);
      accountantOverview = {receipts:allReceipts||[],documents:allDocuments||[],receiptStatuses:receiptStatuses||[],documentStatuses:documentStatuses||[]};
    } else accountantOverview = {receipts:[],documents:[],receiptStatuses:[],documentStatuses:[]};

    if(accountingOffice){
      const officeId=accountingOffice.organization_id;
      const [{data:userSettings},{data:pendingInvites}] = await Promise.all([
        supabase.from("accountant_user_settings").select("*").eq("user_id",user.id).eq("accounting_organization_id",officeId).maybeSingle(),
        supabase.from("client_invitations").select("id,company_pib,company_name,email,phone,invite_channel,status,expires_at,created_at,sent_at").eq("accounting_organization_id",officeId).eq("status","pending").order("created_at",{ascending:false}).limit(100)
      ]);
      let staff:any[]=[];let assignments:any[]=[];
      const isAdmin=(accountingOffice.role==="owner" && accountingOffice.owner_user_id===user.id) || accountingOffice.accounting_access_role==="admin";
      if(isAdmin){
        const {data:staffMemberships}=await supabase.from("organization_members").select("user_id,role").eq("organization_id",officeId).in("role",["owner","employee"]);
        const ids=(staffMemberships||[]).map((m:any)=>m.user_id);
        const {data:staffProfiles}=ids.length?await supabase.from("profiles").select("user_id,username,full_name,auth_email,global_role,created_at").in("user_id",ids):{data:[] as any[]};
        const roleMap=new Map((staffMemberships||[]).map((m:any)=>[String(m.user_id),m.role]));
        staff=(staffProfiles||[]).map((p:any)=>({...p,office_role:roleMap.get(String(p.user_id))}));
        const {data:assignmentRows}=await supabase.from("accountant_client_assignments").select("employee_user_id,client_organization_id,created_at").eq("accounting_organization_id",officeId);
        assignments=assignmentRows||[];
      }
      const incomingConnectionRequests=await loadIncomingConnections(admin,'accounting',accountingOffice,profile.auth_email||user.email||'');
      accountantContext={office:accountingOffice,isAdmin,userSettings:userSettings||{notify_new_receipts:true,notify_new_documents:true,notify_deadlines:true},staff,assignments,pendingInvites:pendingInvites||[],incomingConnectionRequests};
    }
  }

  if(profile.global_role!=="master_admin"){
    const billingOrg=accountantOnly?accountingOffice:activeOrg;
    if(billingOrg && billingOrg.status!=="paused"){
      const sub=billingOrg.subscription;
      const now=Date.now();
      const trialOk=sub?.status==="trial" && sub?.trial_ends_at && new Date(sub.trial_ends_at).getTime()>now;
      const providerOk=Boolean(sub?.provider_subscription_id) && (
        ["active","paused","past_due"].includes(String(sub?.status||"")) ||
        (sub?.status==="cancelled" && new Date(sub?.ends_at||sub?.current_period_end||0).getTime()>now)
      );
      const bankOk=String(sub?.provider||"")==="bank_transfer" && sub?.status==="active" && new Date(sub?.current_period_end||sub?.renews_at||0).getTime()>now;
      if(!trialOk&&!providerOk&&!bankOk){
        return <SubscriptionRequired organization={{...billingOrg,id:billingOrg.organization_id}} subscription={sub||{plan:billingOrg.plan,status:"pending_checkout"}} profile={profile}/>;
      }
    }
  }

  let receipts:any[] = [];
  if (activeOrg && !accountantOnly) {
    let query = supabase.from("receipts").select("*").eq("organization_id",activeOrg.organization_id).order("created_at",{ascending:false}).limit(250);
    if (activeOrg.role === "accountant") query = query.not("sent_to_accountant_at","is",null);
    const { data } = await query; receipts = data || [];
  }

  let master:any = null;
  if (profile.global_role === "master_admin") {
    const [{data:organizations},{data:allMembers},{data:allProfiles},{data:allReceipts},{data:billingInvoices},{data:payouts},{data:rewards},{data:issuerSettings},{data:allSubscriptions},{data:accountantCompanyRelations},{data:bankTransactions}] = await Promise.all([
      supabase.from("organizations").select("*").order("created_at",{ascending:false}),
      supabase.from("organization_members").select("id,organization_id,user_id,role,accounting_access_role"),
      supabase.from("profiles").select("user_id,username,full_name,auth_email,global_role,created_at"),
      supabase.from("receipts").select("id,organization_id,created_at,sent_to_accountant_at"),
      supabase.from("billing_invoices").select("*").order("issued_at",{ascending:false}).limit(3000),
      supabase.from("accountant_payouts").select("*").order("period_month",{ascending:false}).limit(1000),
      supabase.from("accountant_rewards").select("*").order("created_at",{ascending:false}).limit(1000),
      supabase.from("billing_issuer_settings").select("*").eq("active",true).eq("is_demo",false).limit(1).maybeSingle(),
      supabase.from("subscriptions").select("*"),
      admin.from("accountant_company").select("*").order("created_at",{ascending:false}).limit(3000),
      admin.from("bank_transactions").select("*").order("booked_at",{ascending:false}).limit(1000)
    ]);
    master = {organizations:organizations||[],members:allMembers||[],profiles:allProfiles||[],receipts:allReceipts||[],billingInvoices:billingInvoices||[],payouts:payouts||[],rewards:rewards||[],issuerSettings:issuerSettings||null,subscriptions:allSubscriptions||[],accountantCompanyRelations:accountantCompanyRelations||[],bankTransactions:bankTransactions||[],bankConfigured:Boolean(process.env.BANK_API_URL&&process.env.BANK_API_TOKEN)};
  }

  return <Dashboard profile={profile} organizations={orgs} activeOrg={activeOrg||null} receipts={receipts} master={master} accountantOverview={accountantOverview} accountantContext={accountantContext} accessContext={accessContext} />;
}
