import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { checkSearchRateLimit } from '@/lib/company-registry';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!(await checkSearchRateLimit(`login:${ip}`))) return NextResponse.json({error:'Previše pokušaja. Pokušajte za minut.'},{status:429});
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({error:'Neispravan zahtev.'},{status:400});
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!username || username.length > 254 || !password || password.length > 256) return NextResponse.json({error:'Unesite korisničko ime/email i lozinku.'},{status:400});
    let email = username;
    if (!username.includes('@')) {
      const {data, error} = await createAdminClient().from('profiles').select('auth_email').eq('username', username).maybeSingle();
      if (error) throw error;
      if (!data?.auth_email) return NextResponse.json({error:'Pogrešno korisničko ime/email ili lozinka.'},{status:401});
      email = data.auth_email;
    }
    const supabase = await createClient();
    const {error} = await supabase.auth.signInWithPassword({email, password});
    if (error) return NextResponse.json({error:'Pogrešno korisničko ime/email ili lozinka.'},{status:401});
    return NextResponse.json({ok:true});
  } catch {
    return NextResponse.json({error:'Prijava trenutno nije dostupna.'},{status:503});
  }
}
