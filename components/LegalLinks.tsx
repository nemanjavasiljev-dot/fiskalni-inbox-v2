import Link from "next/link";

export default function LegalLinks({className="legal-footer-links"}:{className?:string}){
  return <div className={className}>
    <Link href="/politika-privatnosti">Politika privatnosti</Link>
    <Link href="/uslovi-koriscenja">Uslovi korišćenja</Link>
  </div>;
}
