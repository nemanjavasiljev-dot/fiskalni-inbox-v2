export type NbsCompany = {
  pib: string;
  registrationNumber: string | null;
  name: string | null;
  shortName: string | null;
  legalForm: string | null;
  status: string | null;
  address: string | null;
  city: string | null;
  municipality: string | null;
  postalCode: string | null;
  activityCode: string | null;
  activityName: string | null;
  raw: Record<string, unknown>;
};

export class NbsNotConfiguredError extends Error {
  code = 'NBS_NOT_CONFIGURED';
  constructor() {
    super('NBS servis nije konfigurisan.');
  }
}

export class NbsNotFoundError extends Error {
  code = 'NBS_NOT_FOUND';
  constructor() {
    super('Kompanija sa unetim PIB-om nije pronađena.');
  }
}

export class NbsServiceError extends Error {
  code = 'NBS_SERVICE_ERROR';
  constructor(message = 'NBS servis trenutno nije dostupan.') {
    super(message);
  }
}

const DEFAULT_URL = 'https://webservices.nbs.rs/CommunicationOfficeService1_0/CompanyAccountXmlService.asmx';
const SOAP_ACTION = 'http://communicationoffice.nbs.rs/GetCompanyAccount';

function xmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function cleanText(value: string | null | undefined) {
  if (!value) return null;
  const text = decodeXml(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text || null;
}

function findTag(xml: string, aliases: string[]) {
  for (const alias of aliases) {
    const safe = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(`<(?:(?:[A-Za-z0-9_]+):)?${safe}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[A-Za-z0-9_]+):)?${safe}>`, 'i');
    const match = xml.match(rx);
    const text = cleanText(match?.[1]);
    if (text) return text;
  }
  return null;
}

function extractSoapResult(xml: string) {
  const fault = findTag(xml, ['faultstring', 'Reason', 'Text']);
  if (/soap:fault|soapenv:fault|<fault/i.test(xml) && fault) {
    throw new NbsServiceError(`NBS SOAP greška: ${fault}`);
  }
  const match = xml.match(/<(?:(?:[A-Za-z0-9_]+):)?GetCompanyAccountResult\b[^>]*>([\s\S]*?)<\/(?:(?:[A-Za-z0-9_]+):)?GetCompanyAccountResult>/i);
  if (!match) throw new NbsServiceError('NBS odgovor nema očekivani rezultat.');
  return decodeXml(match[1]).trim();
}

function normalizeDigits(value: string | null, max = 20) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, max);
  return digits || null;
}

export function parseNbsCompany(xml: string, requestedPib: string): NbsCompany {
  // The XML service returns an XML string inside the SOAP result. Field names
  // have changed across NBS schemas, so aliases are intentionally tolerant.
  const pib = normalizeDigits(findTag(xml, [
    'TaxIdentificationNumber', 'taxIdentificationNumber', 'PIB', 'Pib', 'TaxId', 'TaxNumber'
  ]), 20);
  if (!pib || !/^\d{9}$/.test(pib)) throw new NbsServiceError('NBS odgovor nema ispravan PIB.');
  const registrationNumber = normalizeDigits(findTag(xml, [
    'NationalIdentificationNumber', 'nationalIdentificationNumber', 'RegistrationNumber',
    'CompanyRegistrationNumber', 'MaticniBroj', 'MaticniBrojFirme', 'MB'
  ]), 12);
  const name = findTag(xml, ['CompanyName', 'companyName', 'Name', 'Naziv', 'BusinessName']);
  const shortName = findTag(xml, ['ShortName', 'AbbreviatedName', 'SkraceniNaziv']);
  const legalForm = findTag(xml, ['LegalForm', 'LegalFormName', 'PravnaForma']);
  const status = findTag(xml, ['Status', 'CompanyStatus', 'RegistryStatus']);
  const address = findTag(xml, ['Address', 'CompanyAddress', 'StreetAddress', 'Adresa']);
  const city = findTag(xml, ['City', 'Place', 'Settlement', 'Mesto', 'Naselje']);
  const municipality = findTag(xml, ['Municipality', 'MunicipalityName', 'Opstina']);
  const postalCode = normalizeDigits(findTag(xml, ['PostalCode', 'ZipCode', 'PostanskiBroj']), 10);
  const activityCode = findTag(xml, ['ActivityCode', 'MainActivityCode', 'SifraDelatnosti']);
  const activityName = findTag(xml, ['ActivityName', 'MainActivityName', 'NazivDelatnosti']);

  if (pib !== requestedPib) throw new NbsServiceError('NBS je vratio drugi PIB.');
  if (!registrationNumber && !name) throw new NbsNotFoundError();

  return {
    pib,
    registrationNumber,
    name,
    shortName,
    legalForm,
    status,
    address,
    city,
    municipality,
    postalCode,
    activityCode,
    activityName,
    raw: {
      pib,
      registrationNumber,
      name,
      shortName,
      legalForm,
      status,
      address,
      city,
      municipality,
      postalCode,
      activityCode,
      activityName,
    },
  };
}

export function isNbsConfigured() {
  return Boolean(
    process.env.NBS_USERNAME &&
    process.env.NBS_PASSWORD &&
    process.env.NBS_LICENCE_ID
  );
}

export async function lookupNbsCompanyByPib(pib: string): Promise<NbsCompany> {
  if (!isNbsConfigured()) throw new NbsNotConfiguredError();

  const username = String(process.env.NBS_USERNAME || '');
  const password = String(process.env.NBS_PASSWORD || '');
  const licenceId = String(process.env.NBS_LICENCE_ID || '');
  const endpoint = String(process.env.NBS_COMPANY_ACCOUNT_URL || DEFAULT_URL);
  const timeoutMs = Math.max(3000, Math.min(30000, Number(process.env.NBS_LOOKUP_TIMEOUT_MS || 12000)));

  const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <AuthenticationHeader xmlns="http://communicationoffice.nbs.rs">
      <UserName>${xmlEscape(username)}</UserName>
      <Password>${xmlEscape(password)}</Password>
      <LicenceID>${xmlEscape(licenceId)}</LicenceID>
    </AuthenticationHeader>
  </soap:Header>
  <soap:Body>
    <GetCompanyAccount xmlns="http://communicationoffice.nbs.rs">
      <nationalIdentificationNumber xsi:nil="true" />
      <taxIdentificationNumber>${xmlEscape(pib)}</taxIdentificationNumber>
      <bankCode xsi:nil="true" />
      <accountNumber xsi:nil="true" />
      <controlNumber xsi:nil="true" />
      <companyName></companyName>
      <city></city>
      <startItemNumber>1</startItemNumber>
      <endItemNumber>100</endItemNumber>
    </GetCompanyAccount>
  </soap:Body>
</soap:Envelope>`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `"${SOAP_ACTION}"`,
        'User-Agent': 'FiscalBox/5.5',
      },
      body,
      signal: controller.signal,
      cache: 'no-store',
    });
    const text = await response.text();
    if (!response.ok) throw new NbsServiceError(`NBS HTTP ${response.status}.`);
    const resultXml = extractSoapResult(text);
    if (!resultXml || /^\s*(0|null|false)?\s*$/i.test(resultXml)) throw new NbsNotFoundError();
    return parseNbsCompany(resultXml, pib);
  } catch (error: any) {
    if (error instanceof NbsNotConfiguredError || error instanceof NbsNotFoundError || error instanceof NbsServiceError) throw error;
    if (error?.name === 'AbortError') throw new NbsServiceError('NBS servis nije odgovorio u predviđenom roku.');
    throw new NbsServiceError('NBS servis trenutno nije dostupan.');
  } finally {
    clearTimeout(timer);
  }
}
