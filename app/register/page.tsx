import Link from 'next/link';
import RegisterForm from './register-form';
import BrandWordmark from '@/components/BrandWordmark';

export default async function RegisterPage({searchParams}:{searchParams:Promise<{plan?:string}>}){
  const sp=await searchParams;
  const initialPlan=['trial','basic','premium'].includes(String(sp.plan||''))?String(sp.plan):'trial';
  return <main className="auth-wrap register-wrap">
    <div className="card auth-card register-card">
      <Link className="brand" href="/"><span className="logo">F</span><BrandWordmark/></Link>
      <div className="register-head"><span className="pill">NOVI NALOG</span><h1>Registracija</h1><p className="muted">Otvorite nalog za firmu ili knjigovođu. Probni paket traje 10 dana i ne naplaćuje se.</p></div>
      <RegisterForm initialPlan={initialPlan}/>
      <div className="register-login-link">Već imate nalog? <Link href="/login"><b>Prijavite se</b></Link></div>
    </div>
  </main>;
}
