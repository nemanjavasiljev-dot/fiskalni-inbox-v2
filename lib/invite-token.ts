export async function hashInviteToken(token:string){
  const bytes=new TextEncoder().encode(token);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

export function createInviteToken(){
  return `${crypto.randomUUID()}-${crypto.randomUUID().replaceAll('-','')}`;
}
