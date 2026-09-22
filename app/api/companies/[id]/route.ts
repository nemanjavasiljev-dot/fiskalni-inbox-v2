import { NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/company-registry';
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;const c=await getCompanyById(id);if(!c)return NextResponse.json({error:'Firma nije pronađena.'},{status:404});return NextResponse.json({company:c});}catch{return NextResponse.json({error:'Podaci firme trenutno nisu dostupni.'},{status:500});}}
