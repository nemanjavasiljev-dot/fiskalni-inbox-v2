const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require(process.env.FISCALBOX_TYPESCRIPT_PATH || 'typescript');
const root=path.resolve(__dirname,'..');
function load(name,mocks={},cache=new Map()){
 const file=path.resolve(root,name);
 if(cache.has(file))return cache.get(file).exports;
 const source=fs.readFileSync(file,'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};cache.set(file,module);
 function req(id){if(Object.hasOwn(mocks,id))return mocks[id];if(id.startsWith('@/'))return load(id.slice(2)+'.ts',mocks,cache);return require(id);}
 vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`,{URL,Request,Response,Headers,AbortController,AbortSignal,fetch:(...args)=>global.fetch(...args),setTimeout,clearTimeout,process,Buffer,console,Date},{filename:file})(req,module,module.exports);
 return module.exports;
}
const ids=load('lib/company-identifiers.ts');
test('PIB: validan zvanični primer i kontrolna cifra',()=>{
 assert.equal(ids.isValidPib('103445385'),true);
 for(const invalid of ['103445384','1034453850','x103445385','000000000','',null]) assert.equal(ids.isValidPib(invalid),false, String(invalid));
 assert.equal(ids.normalizePib('1034453850'),'1034453850');
});
const redirects=load('lib/safe-redirect.ts');
test('OAuth: spoljašnji i protokol-relativni URL odbijeni',()=>{
 for(const value of ['https://evil.invalid','//evil.invalid','/\\evil.invalid','/\n/evil.invalid'])assert.equal(redirects.safeRedirectPath(value,'https://fiscalbox.test'),'/app');
 assert.equal(redirects.safeRedirectPath('/reset-password?x=1','https://fiscalbox.test'),'/reset-password?x=1');
});
const fiscal=load('lib/fiscal.ts');
test('Fiskalni QR: dozvoljeni domen, protokol, port i kredencijali',()=>{
 assert.equal(fiscal.isAllowedFiscalUrl('https://suf.purs.gov.rs/v/?vl=test'),true);
 for(const value of ['http://suf.purs.gov.rs','https://purs.gov.rs.evil.invalid','https://user:pass@suf.purs.gov.rs','https://suf.purs.gov.rs:8443'])assert.equal(fiscal.isAllowedFiscalUrl(value),false);
});
test('Nevalidan račun se ne označava kao validan',()=>{
 for(const value of ['invalid','nevalidan','not valid','nije validan','неисправан'])assert.equal(fiscal.verificationStatus(value).valid,false,value);
 assert.equal(fiscal.verificationStatus('valid').valid,true);
 assert.equal(fiscal.verificationStatus('unknown').valid,null);
});
const parser=load('lib/nbs-public-parser.ts');
const fixture=fs.readFileSync(path.join(__dirname,'fixtures/nbs-synthetic.html'),'utf8');
test('NBS sintetički odgovor: kolone, entiteti i deduplikacija računa',()=>{
 const rows=parser.parsePublicNbsResults(fixture,'103445385');assert.equal(rows.length,1);
 assert.equal(rows[0].name,'Agencija & registar');assert.equal(rows[0].registration_number,'17580175');
});
test('NBS: nepoznat format nije lažni rezultat ili poruka da firme nema',()=>{
 assert.throws(()=>parser.parsePublicNbsResults('<html>captcha</html>','103445385'));
 assert.equal(parser.parsePublicNbsResults('<p>Нема података</p>','103445385').length,0);
 assert.equal(parser.parsePublicNbsResults(fixture,'100000000').length,0);
});
test('NBS: MB duži od 8 cifara se ne skraćuje',()=>{
 const html=fixture.replaceAll('17580175','1234567890123');
 assert.equal(parser.parsePublicNbsResults(html,'103445385')[0].registration_number,'1234567890123');
});
test('NBS: neslaganje identiteta se odbija',()=>{
 const html=fixture.replace('</table>', '<tr><td>Druga firma</td><td>87654321</td><td>103445385</td><td>Adresa</td></tr></table>');
 assert.throws(()=>parser.parsePublicNbsResults(html,'103445385'));
});
const conn=load('lib/connection-requests.ts',{'@/lib/mailer':{},'@/lib/sms':{}});
test('Poziv: izmenjivi kontakt i telefon nisu dokaz identiteta',()=>{
 assert.equal(conn.requestMatchesRecipient({channel:'email',recipient_email:'a@test.rs'},'b@test.rs',{contact_email:'a@test.rs'}),false);
 assert.equal(conn.requestMatchesRecipient({channel:'email',recipient_email:'a@test.rs'},'A@test.rs',{}),true);
 assert.equal(conn.requestMatchesRecipient({channel:'sms',recipient_phone:'+381601234567'},'',{contact_phone:'+381601234567'}),false);
 assert.equal(conn.requestMatchesRecipient({target_organization_id:'other',channel:'email',recipient_email:'a@test.rs'},'a@test.rs',{id:'mine'}),false);
 assert.equal(conn.requestMatchesRecipient({target_organization_id:'mine'},'',{id:'mine'}),true);
});
const soap=load('lib/company-registry/nbs-service.ts');
test('SOAP odbija PIB drugog subjekta',()=>{
 assert.throws(()=>soap.parseNbsCompany('<PIB>103445384</PIB><CompanyName>Other</CompanyName>','103445385'));
});
test('NBS adapter bez ključa šalje tačan PIB, ima timeout i odbija redirect',async()=>{
 const before=global.fetch;
 global.fetch=async (url,opts)=>{
   assert.equal(new URL(url).searchParams.get('CompanyTaxCode'),'103445385');
   assert.equal(opts.redirect,'error');assert.ok(opts.signal);
   return new Response(fixture,{headers:{'content-type':'text/html'}});
 };
 try {const adapter=load('lib/nbs-company-resolver.ts');assert.equal((await adapter.resolvePibViaNbs('103445385')).length,1);}
 finally{global.fetch=before;}
});
test('NBS nedostupnost se ne prikazuje kao nepostojeća firma',async()=>{
 const before=global.fetch;global.fetch=async()=>new Response('down',{status:503});
 try{const adapter=load('lib/nbs-company-resolver.ts');await assert.rejects(()=>adapter.resolvePibViaNbs('103445385'));}
 finally{global.fetch=before;}
});
function adminCache(cached,writeError=null){
 return {from(){let action='read';return {
   select(){return this;},eq(){return this;},update(){action='write';return this;},insert(){action='write';return this;},
   maybeSingle:async()=>({data:cached,error:null}),single:async()=>({data:writeError?null:{id:'new-company',pib:'103445385',name:'APR'},error:writeError})
 };}};
}
const registryMocks=(admin,resolve)=>({
 '@/lib/supabase/admin':{createAdminClient:()=>admin},
 '@/lib/company-registry':{normalizeCompanyName:x=>String(x).toLowerCase(),publicCompany:x=>x},
 '@/lib/nbs-company-resolver':{resolvePibViaNbs:resolve},
});
test('PIB servis bez SOAP ključeva koristi besplatni adapter',async()=>{
 const env={...process.env};delete process.env.NBS_USERNAME;delete process.env.NBS_PASSWORD;delete process.env.NBS_LICENCE_ID;delete process.env.NBS_PUBLIC_LOOKUP_ENABLED;
 let calls=0;
 try{
  const service=load('lib/company-registry/company-registry-service.ts',registryMocks(adminCache(null),async()=>{calls++;return [{pib:'103445385',name:'APR',registration_number:'17580175'}];}));
  const result=await service.lookupCompanyByPib('103445385');assert.equal(result.source,'NBS_PUBLIC');assert.equal(calls,1);
 }finally{process.env=env;}
});
test('Svež keš izbegava mrežni zahtev',async()=>{
 const cached={id:'known',pib:'103445385',registry_checked_at:new Date().toISOString()};
 const service=load('lib/company-registry/company-registry-service.ts',registryMocks(adminCache(cached),async()=>{throw new Error('Mreža ne sme biti pozvana');}));
 assert.equal((await service.lookupCompanyByPib('103445385')).cached,true);
});
test('Ručni zapis se proverava čak i ako ima nov datum',async()=>{
 const env={...process.env};delete process.env.NBS_USERNAME;delete process.env.NBS_PUBLIC_LOOKUP_ENABLED;
 let called=false;
 try{
  const cached={id:'manual',pib:'103445385',manual_review_required:true,registry_checked_at:new Date().toISOString()};
  const service=load('lib/company-registry/company-registry-service.ts',registryMocks(adminCache(cached),async()=>{called=true;throw new Error('nedostupno');}));
  const result=await service.lookupCompanyByPib('103445385');assert.equal(called,true);assert.ok(result.warning);assert.equal(result.company.manual_review_required,true);
 }finally{process.env=env;}
});
test('Login MASTER/MASTER ne kreira privilegovani nalog',async()=>{
 let signins=0;
 const route=load('app/api/auth/username-login/route.ts',{
  'next/server':{NextResponse:{json:(v,opts)=>Response.json(v,opts)}},
  '@/lib/company-registry':{checkSearchRateLimit:async()=>true},
  '@/lib/supabase/admin':{createAdminClient:()=>adminCache(null)},
  '@/lib/supabase/server':{createClient:async()=>({auth:{signInWithPassword:async()=>{signins++;return {};}}})},
 });
 const result=await route.POST(new Request('https://fiscalbox.test/api/auth/username-login',{method:'POST',body:JSON.stringify({username:'MASTER',password:'MASTER'})}));
 assert.equal(result.status,401);assert.equal(signins,0);
});
test('Webhook: neuspeh transakcije vraća 503 radi ponovne isporuke',async()=>{
 const {createHmac}=require('crypto');const env={...process.env};process.env.LEMONSQUEEZY_WEBHOOK_SECRET='test-secret';process.env.LEMONSQUEEZY_STORE_ID='test-store';
 const payload={meta:{event_name:'subscription_updated',custom_data:{organization_id:'org'}},data:{id:'sub',attributes:{store_id:'test-store',variant_id:'basic',status:'active'}}};
 const raw=JSON.stringify(payload);let called=false;
 try{
  const route=load('app/api/webhooks/lemonsqueezy/route.ts',{
   'next/server':{NextResponse:{json:(v,opts)=>Response.json(v,opts)}},
   '@/lib/supabase/admin':{createAdminClient:()=>({rpc:async()=>{called=true;return {error:{code:'test_failure'}};}})},
   '@/lib/subscriptions':{planForVariant:()=> 'basic'},
  });
  const result=await route.POST(new Request('https://fiscalbox.test/api/webhooks/lemonsqueezy',{method:'POST',body:raw,headers:{'x-signature':createHmac('sha256','test-secret').update(raw).digest('hex')}}));
  assert.equal(called,true);assert.equal(result.status,503);
 }finally{process.env=env;}
});
test('Nepoznat tekst o validaciji nije dokaz da je račun validan',()=>{
 assert.equal(fiscal.verificationStatus('validation pending').valid,null);
 assert.equal(fiscal.verificationStatus('nije važeći').valid,false);
 assert.equal(fiscal.verificationStatus('not currently valid').valid,false);
});
test('Lokalizovani iznosi i prazna vrednost',()=>{
 assert.equal(fiscal.normalizeVerification({totalAmount:'1.234,56'}).total_amount,1234.56);
 assert.equal(fiscal.normalizeVerification({totalAmount:'1,234.56'}).total_amount,1234.56);
 assert.equal(fiscal.normalizeVerification({totalAmount:''}).total_amount,null);
});
test('SOAP bez PIB-a nije potvrđena kompanija',()=>{
 assert.throws(()=>soap.parseNbsCompany('<Name>Greška</Name>','103445385'));
});
test('MERGE 5.9.1: bank/IPS i ZIP funkcije su zadržane',()=>{
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 assert.equal(pkg.version,'5.9.1');
 assert.ok(pkg.dependencies.jszip);
 assert.ok(fs.existsSync(path.join(root,'lib/ips-payment.ts')));
 assert.ok(fs.existsSync(path.join(root,'lib/bank-reconciliation.ts')));
 assert.ok(fs.existsSync(path.join(root,'lib/accountant-download.ts')));
});
test('MERGE 5.9.1: bankarsko rasknjižavanje koristi atomsku RPC funkciju',()=>{
 const billing=fs.readFileSync(path.join(root,'lib/billing.ts'),'utf8');
 const sql=fs.readFileSync(path.join(root,'supabase/migrations/023_v5_9_1_atomic_bank_settlement.sql'),'utf8');
 assert.match(billing,/rpc\('settle_bank_proforma'/);
 assert.match(sql,/create or replace function public\.settle_bank_proforma/);
 assert.match(sql,/for update/);
});
test('MERGE 5.9.1: masovno preuzimanje ponovo proverava aktivnu knjigovodstvenu vezu',()=>{
 const route=fs.readFileSync(path.join(root,'app/api/accountant/download-all/route.ts'),'utf8');
 const helper=fs.readFileSync(path.join(root,'lib/accountant-download-access.ts'),'utf8');
 assert.match(route,/getAuthorizedAccountantClientIds/);
 assert.match(helper,/accountant_company/);
 assert.match(helper,/status', 'active/);
 assert.match(helper,/accountant_client_assignments/);
});
test('MERGE 5.9.1: migracije posle starog SQL 017 nemaju koliziju',()=>{
 const names=fs.readdirSync(path.join(root,'supabase/migrations')).filter(x=>/^0(18|19|20|21|22|23)_/.test(x));
 assert.deepEqual(names.sort(),[
  '018_v5_9_1_security.sql','019_v5_9_1_atomic_lemonsqueezy.sql','020_v5_9_1_company_creation_guard.sql',
  '021_v5_9_1_accountant_access.sql','022_v5_9_1_billing_bank_download_all.sql','023_v5_9_1_atomic_bank_settlement.sql'
 ]);
});
