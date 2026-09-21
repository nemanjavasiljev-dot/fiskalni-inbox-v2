import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const url = new URL(request.url);
  const origin = url.origin;
  const plan = url.searchParams.get("plan") === "premium" ? "premium" : "basic";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=/app&plan=${plan}`
    }
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${origin}/login?error=google`);
  }

  const response = NextResponse.redirect(data.url);
  response.cookies.set("fi_selected_plan", plan, {
    httpOnly:true, sameSite:"lax", secure:origin.startsWith("https"), maxAge:900, path:"/"
  });
  return response;
}
