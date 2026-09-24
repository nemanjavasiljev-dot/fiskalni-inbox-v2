import { NextResponse } from "next/server";
export async function GET(){
  return NextResponse.json({publicKey:process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||null,configured:Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY)},{headers:{"Cache-Control":"no-store, max-age=0"}});
}
