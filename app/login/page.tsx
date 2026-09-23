import Link from "next/link";
import { Suspense } from "react";
import LoginPanel from "./panel";
import BrandWordmark from "@/components/BrandWordmark";
import LegalLinks from "@/components/LegalLinks";

export default function LoginPage() {
  return (
    <main className="auth-wrap">
      <div className="card auth-card">
        <Link className="brand" href="/">
          <span className="logo">F</span>
          <BrandWordmark/>
        </Link>
        <h1>Prijava</h1>
        <p className="muted">Prijavite se korisničkim imenom ili email adresom i lozinkom.</p>
        <Suspense fallback={<div>Učitavanje prijave...</div>}>
          <LoginPanel />
        </Suspense>
        <LegalLinks className="auth-legal-links"/>
      </div>
    </main>
  );
}
