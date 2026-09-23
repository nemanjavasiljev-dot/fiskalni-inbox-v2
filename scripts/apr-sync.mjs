import https from 'node:https';

const APR_URL =
  process.env.APR_OPEN_DATA_URL ||
  'https://openapi.apr.gov.rs/api/opendata/companies';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

const BATCH_SIZE = Math.max(
  100,
  Math.min(
    2000,
    Number(process.env.APR_SYNC_BATCH_SIZE || 750)
  )
);

const REGISTRY_KIND = String(process.env.APR_REGISTRY_KIND || 'company').toLowerCase() === 'entrepreneur' ? 'entrepreneur' : 'company';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'Missing SUPABASE_URL / SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).'
  );
  process.exit(1);
}

/* ============================================================
   NORMALIZACIJA TEKSTA
============================================================ */

const CYR = {
  'а': 'a',
  'б': 'b',
  'в': 'v',
  'г': 'g',
  'д': 'd',
  'ђ': 'dj',
  'е': 'e',
  'ж': 'z',
  'з': 'z',
  'и': 'i',
  'ј': 'j',
  'к': 'k',
  'л': 'l',
  'љ': 'lj',
  'м': 'm',
  'н': 'n',
  'њ': 'nj',
  'о': 'o',
  'п': 'p',
  'р': 'r',
  'с': 's',
  'т': 't',
  'ћ': 'c',
  'у': 'u',
  'ф': 'f',
  'х': 'h',
  'ц': 'c',
  'ч': 'c',
  'џ': 'dz',
  'ш': 's'
};

const latinize = v =>
  Array.from(String(v ?? '').toLowerCase())
    .map(ch => CYR[ch] ?? ch)
    .join('')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(
      /[čćžšđ]/g,
      ch =>
        ({
          č: 'c',
          ć: 'c',
          ž: 'z',
          š: 's',
          đ: 'd'
        }[ch] || ch)
    );

const norm = v =>
  latinize(v)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const digits = v =>
  String(v ?? '').replace(/\D/g, '');

const keyify = v =>
  norm(v).replace(/\s/g, '');


/* ============================================================
   POMOĆNE FUNKCIJE ZA ČITANJE APR PODATAKA
============================================================ */

function scalar(obj, aliases) {
  if (
    !obj ||
    typeof obj !== 'object' ||
    Array.isArray(obj)
  ) {
    return '';
  }

  const wanted = new Set(
    aliases.map(keyify)
  );

  for (const [k, v] of Object.entries(obj)) {
    if (
      wanted.has(keyify(k)) &&
      ['string', 'number', 'boolean'].includes(typeof v)
    ) {
      return String(v ?? '').trim();
    }
  }

  return '';
}


function deepScalar(obj, aliases, maxDepth = 5) {
  const wanted = new Set(aliases.map(keyify));
  const seen = new Set();

  function walk(value, depth) {
    if (!value || typeof value !== 'object' || seen.has(value) || depth > maxDepth) return '';
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 100)) {
        const found = walk(item, depth + 1);
        if (found) return found;
      }
      return '';
    }
    for (const [k, v] of Object.entries(value)) {
      if (wanted.has(keyify(k)) && ['string', 'number', 'boolean'].includes(typeof v)) {
        const text = String(v ?? '').trim();
        if (text) return text;
      }
    }
    for (const v of Object.values(value)) {
      const found = walk(v, depth + 1);
      if (found) return found;
    }
    return '';
  }

  return walk(obj, 0);
}


function child(obj, aliases) {
  if (
    !obj ||
    typeof obj !== 'object' ||
    Array.isArray(obj)
  ) {
    return null;
  }

  const wanted = new Set(
    aliases.map(keyify)
  );

  for (const [k, v] of Object.entries(obj)) {
    if (
      wanted.has(keyify(k)) &&
      v &&
      typeof v === 'object' &&
      !Array.isArray(v)
    ) {
      return v;
    }
  }

  return null;
}


function childName(obj) {
  return scalar(
    obj,
    [
      'name',
      'naziv',
      'title',
      'value'
    ]
  );
}


function parseDate(v) {
  if (!v) {
    return null;
  }

  const d = new Date(v);

  return Number.isNaN(d.getTime())
    ? null
    : d.toISOString().slice(0, 10);
}


/* ============================================================
   PRONALAŽENJE FIRMI U APR JSON-U
============================================================ */

function locateRegistryMap(raw) {
  const seen = new Set();

  let best = null;

  function walk(v, depth = 0) {
    if (
      !v ||
      typeof v !== 'object' ||
      Array.isArray(v) ||
      seen.has(v) ||
      depth > 5
    ) {
      return;
    }

    seen.add(v);

    const entries =
      Object.entries(v);

    const keyed =
      entries.filter(
        ([k, val]) =>
          /^\d{8}$/.test(k) &&
          val &&
          typeof val === 'object' &&
          !Array.isArray(val)
      );

    if (
      keyed.length &&
      (!best || keyed.length > best.length)
    ) {
      best = keyed;
    }

    for (
      const [, val]
      of entries.slice(0, 50)
    ) {
      walk(val, depth + 1);
    }
  }

  walk(raw);

  return best || [];
}


/* ============================================================
   PRETVARANJE APR FIRME U SUPABASE RED
============================================================ */

function rowFrom(
  registrationNumber,
  obj
) {

  const name =
    scalar(
      obj,
      [
        'businessName',
        'business name',
        'poslovnoIme',
        'poslovno ime',
        'name',
        'naziv'
      ]
    );

  if (!name) {
    return null;
  }

  const municipalityObj =
    child(
      obj,
      [
        'municipality',
        'opstina',
        'opština'
      ]
    );

  const activityObj =
    child(
      obj,
      [
        'activity',
        'mainActivity',
        'registeredActivity',
        'pretežna delatnost',
        'pretezna delatnost'
      ]
    );

  const status =
    scalar(
      obj,
      [
        'status',
        'registryStatus',
        'registrationStatus'
      ]
    );

  const legalForm =
    scalar(
      obj,
      [
        'legalForm',
        'legal form',
        'pravnaForma',
        'pravna forma'
      ]
    );

  const founded =
    scalar(
      obj,
      [
        'incorporationDate',
        'foundedAt',
        'registrationDate',
        'datum osnivanja'
      ]
    );

  const activityCode =
    scalar(
      obj,
      [
        'activityCode',
        'mainActivityCode',
        'sifra delatnosti',
        'šifra delatnosti'
      ]
    ) ||
    scalar(
      activityObj,
      [
        'code',
        'sifra',
        'šifra'
      ]
    );

  const activityName =
    scalar(
      obj,
      [
        'activityName',
        'mainActivityName',
        'naziv delatnosti'
      ]
    ) ||
    childName(activityObj);

  const municipality =
    scalar(
      obj,
      [
        'municipalityName',
        'opstina',
        'opština'
      ]
    ) ||
    childName(municipalityObj);

  const city =
    scalar(
      obj,
      [
        'city',
        'place',
        'mesto',
        'naselje'
      ]
    );

  const address =
    scalar(
      obj,
      [
        'address',
        'registeredAddress',
        'adresa'
      ]
    );

  const postal =
    digits(
      scalar(
        obj,
        [
          'postalCode',
          'zip',
          'postanski broj',
          'poštanski broj'
        ]
      )
    );

  // APR izvori nisu potpuno uniformni. Ako PIB postoji bilo gde u originalnom
  // zapisu, izvuci ga po semantičkom nazivu ključa, ali prihvati samo tačno 9 cifara.
  const pibCandidate = digits(deepScalar(obj, [
    'pib', 'poreski broj', 'poreskibroj', 'taxIdentificationNumber',
    'tax identification number', 'taxId', 'taxNumber'
  ]));
  const pib = /^\d{9}$/.test(pibCandidate) ? pibCandidate : null;

  return {
    name,

    registration_number:
      registrationNumber,

    pib,

    registry_kind: REGISTRY_KIND,

    address:
      address || null,

    city:
      city || null,

    municipality:
      municipality || null,

    postal_code:
      postal || null,

    legal_form:
      legalForm || null,

    activity_code:
      activityCode || null,

    activity_name:
      activityName || null,

    registry_status:
      status || null,

    founded_at:
      parseDate(founded),

    apr_source_id:
      registrationNumber,

    apr_raw:
      obj
  };
}


/* ============================================================
   SUPABASE API
============================================================ */

async function api(
  path,
  {
    method = 'GET',
    body,
    prefer
  } = {}
) {

  const r =
    await fetch(
      `${SUPABASE_URL}${path}`,
      {
        method,

        headers: {
          apikey:
            SUPABASE_KEY,

          Authorization:
            `Bearer ${SUPABASE_KEY}`,

          'Content-Type':
            'application/json',

          ...(prefer
            ? { Prefer: prefer }
            : {})
        },

        body:
          body === undefined
            ? undefined
            : JSON.stringify(body)
      }
    );

  if (!r.ok) {
    throw new Error(
      `${method} ${path}: ${r.status} ${await r.text()}`
    );
  }

  const text =
    await r.text();

  return text
    ? JSON.parse(text)
    : null;
}


/* ============================================================
   APR DOWNLOAD

   VAŽNO:
   APR trenutno ima problem sa SSL/TLS sertifikatom.

   SSL provera se isključuje SAMO za:
   openapi.apr.gov.rs

   Supabase i ostale konekcije ostaju potpuno zaštićene.
============================================================ */

function downloadAprJson(
  url,
  redirectCount = 0
) {

  return new Promise(
    (resolve, reject) => {

      if (redirectCount > 5) {
        reject(
          new Error(
            'APR download failed: too many redirects'
          )
        );

        return;
      }

      let target;

      try {
        target = new URL(url);
      } catch {
        reject(
          new Error(
            `Invalid APR URL: ${url}`
          )
        );

        return;
      }

      console.log(
        `Connecting to APR: ${target.hostname}${target.pathname}`
      );

      const options = {

        protocol:
          target.protocol,

        hostname:
          target.hostname,

        port:
          target.port || 443,

        path:
          `${target.pathname}${target.search}`,

        method:
          'GET',

        /*
         * APR sertifikat trenutno ne prolazi
         * Node.js validaciju.
         *
         * Zato proveru sertifikata gasimo
         * ISKLJUČIVO za APR domen.
         */

        rejectUnauthorized:
          target.hostname !==
          'openapi.apr.gov.rs',

        headers: {

          Accept:
            'application/json',

          'User-Agent':
            'FiscalBox-APR-Sync/5.8',

          'Accept-Language':
            'sr-RS,sr;q=0.9,en;q=0.8',

          ...(process.env.APR_API_KEY ? { 'X-API-Key': process.env.APR_API_KEY } : {}),
          ...(process.env.APR_BEARER_TOKEN ? { Authorization: `Bearer ${process.env.APR_BEARER_TOKEN}` } : {}),
          ...(!process.env.APR_BEARER_TOKEN && process.env.APR_USERNAME && process.env.APR_PASSWORD
            ? { Authorization: `Basic ${Buffer.from(`${process.env.APR_USERNAME}:${process.env.APR_PASSWORD}`).toString('base64')}` }
            : {}),

          Connection:
            'close'
        }
      };


      const req =
        https.request(
          options,
          res => {

            const statusCode =
              res.statusCode || 0;

            console.log(
              `APR HTTP status: ${statusCode}`
            );


            /*
             * REDIRECT
             */

            if (
              statusCode >= 300 &&
              statusCode < 400 &&
              res.headers.location
            ) {

              const nextUrl =
                new URL(
                  res.headers.location,
                  target
                ).toString();

              console.log(
                `APR redirect: ${nextUrl}`
              );

              res.resume();

              downloadAprJson(
                nextUrl,
                redirectCount + 1
              )
                .then(resolve)
                .catch(reject);

              return;
            }


            /*
             * HTTP GREŠKA
             */

            if (
              statusCode < 200 ||
              statusCode >= 300
            ) {

              let errorBody = '';

              res.setEncoding('utf8');

              res.on(
                'data',
                chunk => {

                  if (
                    errorBody.length <
                    5000
                  ) {
                    errorBody += chunk;
                  }

                }
              );

              res.on(
                'end',
                () => {

                  reject(
                    new Error(
                      `APR download failed: HTTP ${statusCode}. Response: ${errorBody.slice(0, 1000)}`
                    )
                  );

                }
              );

              return;
            }


            /*
             * USPEŠAN ODGOVOR
             */

            let data = '';

            res.setEncoding(
              'utf8'
            );

            res.on(
              'data',
              chunk => {

                data += chunk;

              }
            );

            res.on(
              'end',
              () => {

                console.log(
                  `APR download completed. Received ${data.length} characters.`
                );

                try {

                  const json =
                    JSON.parse(data);

                  resolve(json);

                } catch (err) {

                  reject(
                    new Error(
                      `APR response is not valid JSON. First 500 characters: ${data.slice(0, 500)}`
                    )
                  );

                }

              }
            );

          }
        );


      /*
       * MREŽNA GREŠKA
       */

      req.on(
        'error',
        err => {

          reject(
            new Error(
              `APR network error: ${err.message}`
            )
          );

        }
      );


      /*
       * TIMEOUT
       */

      req.setTimeout(
        120000,
        () => {

          req.destroy(
            new Error(
              'APR request timeout after 120 seconds'
            )
          );

        }
      );


      req.end();

    }
  );
}


/* ============================================================
   GLAVNI APR SYNC
============================================================ */

async function main() {

  console.log(
    `Downloading APR snapshot: ${APR_URL}`
  );


  /*
   * PREUZIMANJE APR BAZE
   */

  const raw =
    await downloadAprJson(
      APR_URL
    );


  /*
   * PRONALAŽENJE FIRMI
   */

  const entries =
    locateRegistryMap(
      raw
    );


  if (
    entries.length < 1000
  ) {

    console.log(
      'APR response received, but company records were not recognized.'
    );

    console.log(
      'Top-level APR response keys:',
      raw &&
      typeof raw === 'object'
        ? Object.keys(raw).slice(0, 30)
        : []
    );

    throw new Error(
      `APR JSON shape not recognized. Found only ${entries.length} MB-keyed records.`
    );

  }


  console.log(
    `APR records detected: ${entries.length} (${REGISTRY_KIND})`
  );


  /*
   * KREIRAJ APR SYNC RUN
   */

  const runRows =
    await api(
      '/rest/v1/apr_sync_runs',
      {
        method:
          'POST',

        prefer:
          'return=representation',

        body: [
          {
            run_type:
              'scheduled',

            status:
              'running',

            companies_seen:
              entries.length
          }
        ]
      }
    );


  const runId =
    runRows?.[0]?.id ||
    null;


  console.log(
    `APR sync run ID: ${runId || 'none'}`
  );


  let inserted = 0;
  let updated = 0;
  let errors = 0;
  let processed = 0;


  try {

    /*
     * BATCH IMPORT
     */

    for (
      let i = 0;
      i < entries.length;
      i += BATCH_SIZE
    ) {

      const batch = [];


      for (
        const [mb, obj]
        of entries.slice(
          i,
          i + BATCH_SIZE
        )
      ) {

        const row =
          rowFrom(
            mb,
            obj
          );


        if (row) {

          batch.push(
            row
          );

        } else {

          errors++;

        }

      }


      /*
       * UPSERT U SUPABASE
       */

      if (
        batch.length
      ) {

        const result =
          await api(
            '/rest/v1/rpc/bulk_upsert_apr_companies',
            {
              method:
                'POST',

              body: {
                p_rows:
                  batch,

                p_run_id:
                  runId
              }
            }
          );


        const stat =
          Array.isArray(result)
            ? result[0]
            : result;


        inserted +=
          Number(
            stat?.inserted_count ||
            0
          );


        updated +=
          Number(
            stat?.updated_count ||
            0
          );

      }


      processed =
        Math.min(
          entries.length,
          i + BATCH_SIZE
        );


      /*
       * LOG NA SVAKIH OKO 5000 FIRMI
       */

      if (
        processed % 5000 <
        BATCH_SIZE
      ) {

        console.log(
          `Processed ${processed}/${entries.length} | inserted=${inserted} | updated=${updated} | errors=${errors}`
        );

      }

    }


    /*
     * ZAVRŠI SYNC RUN
     */

    if (
      runId
    ) {

      await api(
        `/rest/v1/apr_sync_runs?id=eq.${runId}`,
        {
          method:
            'PATCH',

          prefer:
            'return=minimal',

          body: {

            status:
              errors
                ? 'partial'
                : 'success',

            companies_seen:
              processed,

            inserted_count:
              inserted,

            updated_count:
              updated,

            error_count:
              errors,

            finished_at:
              new Date().toISOString()

          }
        }
      );

    }


    console.log(
      '======================================'
    );

    console.log(
      'APR SYNC COMPLETE'
    );

    console.log(
      `Processed: ${processed}`
    );

    console.log(
      `Inserted: ${inserted}`
    );

    console.log(
      `Updated: ${updated}`
    );

    console.log(
      `Errors: ${errors}`
    );

    console.log(
      '======================================'
    );


  } catch (e) {


    /*
     * UPIS GREŠKE U APR_SYNC_RUNS
     */

    if (
      runId
    ) {

      try {

        await api(
          `/rest/v1/apr_sync_runs?id=eq.${runId}`,
          {
            method:
              'PATCH',

            prefer:
              'return=minimal',

            body: {

              status:
                'failed',

              companies_seen:
                processed,

              inserted_count:
                inserted,

              updated_count:
                updated,

              error_count:
                errors + 1,

              error_summary:
                String(e).slice(
                  0,
                  500
                ),

              finished_at:
                new Date().toISOString()

            }
          }
        );

      } catch (updateError) {

        console.error(
          'Unable to update failed APR sync run:',
          updateError
        );

      }

    }


    throw e;

  }

}


/* ============================================================
   START
============================================================ */

main()
  .catch(
    err => {

      console.error(
        'APR SYNC FAILED'
      );

      console.error(
        err
      );

      process.exit(1);

    }
  );
