import assert from 'node:assert/strict';

const base=(process.env.TEST_APP_URL||'http://localhost:3000').replace(/\/$/,'');
const fixtures={
  name:process.env.TEST_APR_NAME||'',
  exactName:process.env.TEST_APR_EXACT_NAME||process.env.TEST_APR_NAME||'',
  mb:process.env.TEST_APR_MB||''
};

async function search(q){
  const r=await fetch(`${base}/api/companies/search?q=${encodeURIComponent(q)}`);
  const body=await r.json().catch(()=>({}));
  return {status:r.status,body};
}

async function run(){
  console.log(`FiscalBox APR smoke: ${base}`);
  const tooShort=await search('a');
  assert.equal(tooShort.status,200);
  assert.ok(Array.isArray(tooShort.body.results));

  const missing=await search('__FISCALBOX_APR_NON_EXISTENT_COMPANY_9FCE31__');
  assert.ok([200,429,500].includes(missing.status));
  if(missing.status===200) assert.ok(Array.isArray(missing.body.results));

  for(const [kind,value] of Object.entries(fixtures)){
    if(!value){console.log(`SKIP ${kind}: env fixture nije postavljen`);continue;}
    const result=await search(value);
    assert.equal(result.status,200,`${kind}: search status`);
    assert.ok(Array.isArray(result.body.results),`${kind}: results array`);
    assert.ok(result.body.results.length>0,`${kind}: expected result`);
    const first=result.body.results[0];
    assert.ok(first.id&&first.name,`${kind}: central company_id/name`);
    if(kind==='mb') assert.equal(String(first.registration_number||''),String(value).replace(/\D/g,''),'Exact MB mora biti prvi.');
    console.log(`OK ${kind}: ${first.name}`);
  }

  console.log('OK: APR pretraga po nazivu i matičnom broju radi.');
}

run().catch(err=>{console.error(err);process.exit(1)});
