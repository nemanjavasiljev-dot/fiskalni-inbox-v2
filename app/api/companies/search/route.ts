import { NextResponse } from 'next/server';
import { APRSyncService } from '@/lib/apr-sync-service';
import { checkSearchRateLimit, digitsOnly, sanitizeCompanyQuery, searchLocalCompanies } from '@/lib/company-registry';

function clientKey(request: Request) {
  const h=request.headers;
  const forwarded=h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `companies:${forwarded||h.get('x-real-ip')||'unknown'}`;
}

export async function GET(request:Request){
  const q=sanitizeCompanyQuery(new URL(request.url).searchParams.get('q'));
  const digits=digitsOnly(q);
  if(q.length<2 && ![8,9].includes(digits.length)) return NextResponse.json({results:[],warning:'Unesite najmanje 2–3 karaktera.'});
  if(!(await checkSearchRateLimit(clientKey(request)))) return NextResponse.json({error:'Previše zahteva. Pokušajte ponovo za minut.'},{status:429});

  try{
    let local=await searchLocalCompanies(q,15);
    const exact=[8,9].includes(digits.length);
    const staleExact=exact&&local[0]?.apr_last_sync&&Date.now()-new Date(local[0].apr_last_sync).getTime()>30*24*60*60*1000;
    let warning='';
    if(APRSyncService.isConfigured() && (exact ? !local.length||staleExact : local.length<8)){
      try{
        await APRSyncService.searchAndSync(q,15);
        local=await searchLocalCompanies(q,15);
      }catch(e:any){console.error('APR company search',e);warning='APR trenutno nije dostupan. Prikazani su podaci iz FiscalBox baze.';}
    }else if(!APRSyncService.isConfigured()&&!local.length){
      warning='APR web-servis još nije konfigurisan. Pretraga novih firmi trenutno nije dostupna.';
    }
    return NextResponse.json({results:local,apr_configured:APRSyncService.isConfigured(),warning});
  }catch(e:any){console.error('companies-search',e);return NextResponse.json({error:'Pretraga firmi trenutno nije dostupna. Pokušajte ponovo.'},{status:500});}
}
