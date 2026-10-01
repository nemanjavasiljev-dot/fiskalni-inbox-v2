import { spawn } from 'node:child_process';
import process from 'node:process';

function run(kind, url) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, APR_REGISTRY_KIND: kind, APR_OPEN_DATA_URL: url || '' };
    const child = spawn(process.execPath, ['scripts/apr-sync.mjs'], { stdio: 'inherit', env });
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`APR ${kind} sync failed with exit code ${code}`)));
    child.on('error', reject);
  });
}

await run('company', process.env.APR_OPEN_DATA_COMPANIES_URL || process.env.APR_OPEN_DATA_URL || 'https://openapi.apr.gov.rs/api/opendata/companies');
const entrepreneurUrl = String(process.env.APR_OPEN_DATA_ENTREPRENEURS_URL || '').trim();
if (entrepreneurUrl) {
  await run('entrepreneur', entrepreneurUrl);
} else {
  console.warn('APR_OPEN_DATA_ENTREPRENEURS_URL nije podešen. Privredna društva su sinhronizovana, ali preduzetnici nisu preuzeti iz posebnog APR feed-a.');
}
