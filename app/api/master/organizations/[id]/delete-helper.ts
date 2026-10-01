async function listAll(admin:any,bucket:string,prefix:string):Promise<string[]>{
  const out:string[]=[];
  async function walk(folder:string){
    let offset=0;
    while(true){
      const {data,error}=await admin.storage.from(bucket).list(folder,{limit:1000,offset,sortBy:{column:'name',order:'asc'}});
      if(error)throw new Error(`${bucket}: ${error.message}`);
      const rows=data||[];
      for(const item of rows as any[]){
        const path=folder?`${folder}/${item.name}`:item.name;
        if(item.id)out.push(path); else await walk(path);
      }
      if(rows.length<1000)break;
      offset+=1000;
    }
  }
  await walk(prefix);
  return out;
}

export async function purgeOrganizationStorage(admin:any,organizationId:string){
  const buckets=['documents','receipt-images','organization-assets'] as const;
  const result:Record<string,number>={};
  for(const bucket of buckets){
    const paths=await listAll(admin,bucket,organizationId);
    let removed=0;
    for(let i=0;i<paths.length;i+=100){
      const chunk=paths.slice(i,i+100);
      const {error}=await admin.storage.from(bucket).remove(chunk);
      if(error)throw new Error(`${bucket}: ${error.message}`);
      removed+=chunk.length;
    }
    result[bucket]=removed;
  }
  return result;
}
