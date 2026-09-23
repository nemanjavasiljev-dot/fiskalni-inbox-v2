import BrandWordmark from '@/components/BrandWordmark';
import AccountantVerificationClient from './verification-client';

export default async function AccountantInvitePage({searchParams}:{searchParams:Promise<{token?:string}>}){
  const sp=await searchParams;
  return <main className="auth-wrap"><div className="card auth-card invite-activate-card"><a className="brand" href="/"><span className="logo">F</span><BrandWordmark/></a><AccountantVerificationClient token={sp.token||''}/></div></main>;
}
