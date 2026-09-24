import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const REACTIONS=new Set(["received","important","thanks","done"]);

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Niste prijavljeni."},{status:401});
  const {id}=await params;
  const body=await request.json().catch(()=>({}));
  const action=String(body?.action||"");
  const now=new Date().toISOString();
  let patch:Record<string,any>={};
  if(action==="read")patch={read_at:now};
  else if(action==="unread")patch={read_at:null};
  else if(action==="delete")patch={deleted_at:now};
  else if(action==="react"){
    const reaction=String(body?.reaction||"");
    if(!REACTIONS.has(reaction))return NextResponse.json({error:"Nepoznata reakcija."},{status:400});
    patch={reaction,reacted_at:now,read_at:now};
  }else if(action==="clear_reaction")patch={reaction:null,reacted_at:null};
  else return NextResponse.json({error:"Nepoznata akcija."},{status:400});

  const {data,error}=await supabase.from("user_notifications")
    .update(patch)
    .eq("id",id)
    .eq("user_id",user.id)
    .select("id,read_at,reaction,reacted_at,deleted_at")
    .maybeSingle();
  if(error)return NextResponse.json({error:error.message},{status:500});
  if(!data)return NextResponse.json({error:"Notifikacija nije pronađena."},{status:404});
  return NextResponse.json({ok:true,item:data});
}
