import Link from "next/link";
import BrandWordmark from "@/components/BrandWordmark";
import ForgotPasswordForm from "./form";
export default function ForgotPasswordPage(){return <main className="auth-wrap"><div className="card auth-card"><Link className="brand" href="/"><span className="logo">F</span><BrandWordmark/></Link><h1>Nova lozinka</h1><p className="muted">Unesite email kojim je FiscalBox nalog registrovan. Poslaćemo vam bezbedan link za promenu lozinke.</p><ForgotPasswordForm/><div className="register-login-link"><Link href="/login">← Nazad na prijavu</Link></div></div></main>}
