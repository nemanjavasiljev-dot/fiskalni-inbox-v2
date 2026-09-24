// Run only against your own deployment. This is separate from offline regression tests.
const origin=process.env.FISCALBOX_TEST_URL;
const pib=process.env.FISCALBOX_TEST_PIB;
if(!origin||!/^\d{9}$/.test(pib||''))throw new Error('Postavite FISCALBOX_TEST_URL i FISCALBOX_TEST_PIB (poznati PIB vaše firme).');
const url=new URL('/api/company-lookup',origin);url.searchParams.set('pib',pib);
const response=await fetch(url,{signal:AbortSignal.timeout(25000)});
const data=await response.json();
if(!response.ok||!data.ok||data.company?.pib!==pib||!data.company?.name)throw new Error(`Live provera nije prošla: HTTP ${response.status}, ${data.code||'bez koda'}`);
if(data.company.manual_review_required||data.warning)throw new Error('Vraćen je rezervni ili ručni zapis; spoljni registar nije potvrđen.');
console.log(JSON.stringify({ok:true,source:data.source,cached:data.cached,name:data.company.name,pib:data.company.pib,checkedAt:data.checkedAt},null,2));
if(data.cached)console.log('NAPOMENA: ovo potvrđuje samo keš. Ponovite za poznati PIB koji nije u kešu da proverite spoljni servis.');
