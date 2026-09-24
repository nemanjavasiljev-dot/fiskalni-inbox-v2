import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUserIds } from "@/lib/push-delivery";

export async function POST(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Niste prijavljeni."},{status:401});
  const admin=createAdminClient();
  const result=await sendPushToUserIds(admin,[user.id],{
    title:"FiscalBox obaveštenja su aktivna",
    body:"Test obaveštenje je uspešno poslato na ovaj uređaj.",
    url:"/app",
    tag:`push-test-${Date.now()}`,
    notificationType:"push_test"
  });
  if(!result.configured)return NextResponse.json({error:"VAPID ključevi nisu podešeni u Vercel-u.",result},{status:503});
  if(!result.subscriptions)return NextResponse.json({error:"Ovaj uređaj nema sačuvanu push pretplatu.",result},{status:409});
  if(!result.sent)return NextResponse.json({error:"Push pretplata postoji, ali push servis nije prihvatio test poruku. Ponovo uključite obaveštenja na ovom uređaju.",result},{status:502});
  return NextResponse.json({ok:true,...result});
}
