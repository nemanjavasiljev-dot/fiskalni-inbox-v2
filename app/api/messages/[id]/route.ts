import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Niste prijavljeni."},{status:401});
  const {id}=await params;const body=await request.json().catch(()=>({}));const action=String(body?.action||"");
  const admin=createAdminClient();
  const {data:msg,error:readError}=await admin.from("user_messages").select("*").eq("id",id).maybeSingle();
  if(readError)return NextResponse.json({error:readError.message},{status:500});
  if(!msg)return NextResponse.json({error:"Poruka nije pronađena."},{status:404});
  const isSender=String(msg.sender_user_id)===String(user.id);const isRecipient=String(msg.recipient_user_id)===String(user.id);
  if(!isSender&&!isRecipient)return NextResponse.json({error:"Nemate pristup poruci."},{status:403});
  let patch:Record<string,any>={};const now=new Date().toISOString();
  if(action==="read"){
    if(!isRecipient)return NextResponse.json({error:"Samo primalac može označiti poruku kao pročitanu."},{status:403});
    patch={read_at:now};
  }else if(action==="unread"){
    if(!isRecipient)return NextResponse.json({error:"Samo primalac može promeniti status poruke."},{status:403});
    patch={read_at:null};
  }else if(action==="delete"){
    patch=isSender?{deleted_by_sender_at:now}:{deleted_by_recipient_at:now};
  }else return NextResponse.json({error:"Nepoznata akcija."},{status:400});
  const {data,error}=await admin.from("user_messages").update(patch).eq("id",id).select("*").single();
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true,item:data});
}
