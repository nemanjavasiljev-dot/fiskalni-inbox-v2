import Link from 'next/link';
import RegisterForm from './register-form';
import BrandWordmark from '@/components/BrandWordmark';

export default async function RegisterPage({searchParams}:{searchParams:Promise<{plan?:string;trial?:string}>}){
  const sp=await searchParams;
  const initialPlan=sp.plan==='premium'?'premium':'basic';
  const initialTrial=sp.trial==='0'?false:true;
  return <main className="auth-wrap register-wrap">
    <div className="card auth-card register-card">
      <Link className="brand" href="/"><span className="logo">F</span><BrandWordmark/></Link>
      <div className="register-head"><span className="pill">NOVI NALOG</span><h1>Registracija</h1><p className="muted">Otvorite pravi nalog za firmu ili knjigovođu. Basic i Premium mogu da se probaju 10 dana besplatno sa svim funkcijama iz izabranog paketa.</p></div>
      <RegisterForm initialPlan={initialPlan} initialTrial={initialTrial}/>
      <div className="register-login-link">Već imate nalog? <Link href="/login"><b>Prijavite se</b></Link></div>
    </div>
  </main>;
}
