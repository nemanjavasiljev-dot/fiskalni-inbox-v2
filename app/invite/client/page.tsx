import ActivateClient from './activate-client';
import BrandWordmark from '@/components/BrandWordmark';

export default async function ClientInvitePage({searchParams}:{searchParams:Promise<{token?:string}>}){
  const sp=await searchParams;
  return <main className="auth-wrap"><div className="card auth-card invite-activate-card"><a className="brand" href="/"><span className="logo">F</span><BrandWordmark/></a><ActivateClient token={sp.token||''}/></div></main>;
}
