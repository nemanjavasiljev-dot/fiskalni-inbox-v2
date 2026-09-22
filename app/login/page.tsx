import Link from "next/link";
import { Suspense } from "react";
import LoginPanel from "./panel";

export default function LoginPage() {
  return (
    <main className="auth-wrap">
      <div className="card auth-card">
        <Link className="brand" href="/">
          <span className="logo">F</span>
          <span>Fiskalni Inbox</span>
        </Link>
        <h1>Prijava</h1>
        <p className="muted">Prijavite se korisničkim imenom i lozinkom.</p>
        <Suspense fallback={<div>Učitavanje prijave...</div>}>
          <LoginPanel />
        </Suspense>
      </div>
    </main>
  );
}
