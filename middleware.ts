import { normalizeSupabaseUrl } from "@/lib/supabase/url";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/') && !['GET','HEAD','OPTIONS'].includes(request.method)) {
    const origin=request.headers.get('origin');
    const expected=new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).origin;
    if ((origin && origin!==expected) || request.headers.get('sec-fetch-site')==='cross-site') {
      return NextResponse.json({error:'Nedozvoljen izvor zahteva.'},{status:403});
    }
  }
  let response = NextResponse.next({ request });

  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      }
    }
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
