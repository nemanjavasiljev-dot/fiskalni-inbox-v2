import Link from "next/link";
import BrandWordmark from "@/components/BrandWordmark";
import ResetPasswordForm from "./form";
export default function ResetPasswordPage(){return <main className="auth-wrap"><div className="card auth-card"><Link className="brand" href="/"><span className="logo">F</span><BrandWordmark/></Link><h1>Postavite novu lozinku</h1><p className="muted">Nova lozinka mora imati najmanje 8 znakova.</p><ResetPasswordForm/></div></main>}
