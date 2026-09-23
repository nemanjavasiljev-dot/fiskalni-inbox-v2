'use client';

import React from 'react';
import { Building2, CheckCircle2, Loader2, Search, ShieldCheck } from 'lucide-react';
import CompanySearch, { type CompanySearchValue } from '@/components/CompanySearch';

type Props = {
  value?: CompanySearchValue | null;
  onSelect: (company: CompanySearchValue | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  showDetails?: boolean;
  allowNameMbFallback?: boolean;
  className?: string;
  compact?: boolean;
  placeholder?: string;
  allowRefresh?: boolean;
};

function digitsOnly(value: string) {
  return value.replace(/\D/g, '').slice(0, 9);
}

function fmtDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('sr-RS', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function CompanyLookup({
  value = null,
  onSelect,
  label = 'PIB',
  required = false,
  disabled = false,
  showDetails = true,
  allowNameMbFallback = true,
  className = '',
  compact = false,
}: Props) {
  const [pib, setPib] = React.useState(value?.pib || '');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [warning, setWarning] = React.useState('');
  const [showFallback, setShowFallback] = React.useState(false);
  const [source, setSource] = React.useState('');
  const [checkedAt, setCheckedAt] = React.useState<string | null>(null);
  const requestId = React.useRef(0);

  React.useEffect(() => {
    if (value?.pib) setPib(value.pib);
  }, [value?.id, value?.pib]);

  React.useEffect(() => {
    if (disabled || value || showFallback) return;
    if (pib.length < 9) {
      setMessage('');
      setWarning('');
      return;
    }

    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      setMessage('');
      setWarning('');
      try {
        const r = await fetch(`/api/company-lookup?pib=${encodeURIComponent(pib)}`, { cache: 'no-store' });
        const d = await r.json();
        if (id !== requestId.current) return;
        if (!r.ok || !d.ok || !d.company) {
          const err: any = new Error(d.error || 'Kompanija nije pronađena.');
          err.fallback = Boolean(d.fallback);
          err.code = d.code;
          throw err;
        }
        onSelect(d.company as CompanySearchValue);
        setSource(String(d.source || d.company.registry_source || 'NBS+APR'));
        setCheckedAt(d.checkedAt || d.company.registry_checked_at || null);
        setWarning(String(d.warning || ''));
        setMessage('Kompanija je pronađena i proverena u zvaničnim registrima.');
      } catch (e: any) {
        if (id !== requestId.current) return;
        setMessage(e.message || 'Automatska provera registra trenutno nije dostupna.');
        if (e.fallback && allowNameMbFallback) setShowFallback(true);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [pib, disabled, value?.id, showFallback, allowNameMbFallback, onSelect]);

  function clear() {
    requestId.current += 1;
    onSelect(null);
    setPib('');
    setLoading(false);
    setMessage('');
    setWarning('');
    setSource('');
    setCheckedAt(null);
    setShowFallback(false);
  }

  const verifiedByPib = Boolean(value?.pib && ((source || value?.registry_source || '').toUpperCase().includes('NBS') || checkedAt || value?.registry_checked_at));

  return (
    <div className={`company-lookup ${compact ? 'compact' : ''} ${className}`}>
      {!value && !showFallback && (
        <>
          <label className="company-search-label">
            {label}{required && <span aria-hidden="true"> *</span>}
          </label>
          <div className="company-search-input-wrap company-lookup-pib-wrap">
            <Search size={17} />
            <input
              className="company-search-input"
              value={pib}
              disabled={disabled}
              onChange={(e) => setPib(digitsOnly(e.target.value))}
              placeholder="Unesite PIB — 9 cifara"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={9}
              autoComplete="off"
              aria-label="PIB kompanije"
            />
            <span className={`company-lookup-counter ${pib.length === 9 ? 'complete' : ''}`}>{pib.length}/9</span>
            {loading && <Loader2 className="spin" size={17} />}
          </div>
          {loading && <div className="company-lookup-status"><Loader2 className="spin" size={15} /> Pretražujemo zvanične registre…</div>}
          {!loading && message && <div className="company-search-state error-state company-lookup-message">{message}</div>}
          {!loading && !message && pib.length > 0 && pib.length < 9 && <small className="company-lookup-help">PIB mora imati 9 cifara. Pretraga će krenuti automatski.</small>}
        </>
      )}

      {value && (
        <div className="company-lookup-verified">
          <div className="company-lookup-verified-head">
            <div className="company-search-selected-icon"><Building2 size={18} /></div>
            <div className="company-search-selected-copy">
              <b>{value.name}</b>
              <span>PIB: {value.pib || '—'} · MB: {value.registration_number || '—'}</span>
            </div>
            <span className="company-lookup-badge"><ShieldCheck size={14} /> {verifiedByPib ? 'Zvanični registri' : 'APR baza'}</span>
            {!disabled && <button type="button" className="company-search-change" onClick={clear}>Promeni</button>}
          </div>

          <div className="company-lookup-confirm">
            <CheckCircle2 size={17} />
            <div><b>{verifiedByPib ? 'Podaci provereni u zvaničnim registrima' : 'Kompanija pronađena u APR bazi'}</b><span>{warning || (verifiedByPib ? 'Kompanija je spremna za korišćenje u FiscalBox-u.' : 'PIB možete dopuniti kasnije kada automatska provera bude dostupna.')}</span></div>
          </div>

          {showDetails && (
            <div className="company-search-details">
              <div><span>Naziv kompanije</span><b>{value.name}</b></div>
              <div><span>PIB</span><b>{value.pib || '—'}</b></div>
              <div><span>Matični broj</span><b>{value.registration_number || '—'}</b></div>
              {(value.city || value.municipality) && <div><span>Mesto / opština</span><b>{value.city || value.municipality}</b></div>}
              {value.activity_code && <div><span>Šifra delatnosti</span><b>{value.activity_code}</b></div>}
              {value.activity_name && <div><span>Delatnost</span><b>{value.activity_name}</b></div>}
              <div className="company-search-source">
                <span>Izvor: {verifiedByPib ? (source || value.registry_source || 'NBS + APR') : 'APR'} · provera: {verifiedByPib ? fmtDate(checkedAt || value.registry_checked_at) : 'lokalna APR sinhronizacija'}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {!value && showFallback && message && <div className="company-search-state error-state company-lookup-message">{message}</div>}

      {!value && allowNameMbFallback && (
        <div className="company-lookup-fallback">
          {!showFallback ? (
            <button type="button" className="company-lookup-fallback-btn" onClick={() => { setShowFallback(true); setMessage(''); }}>
              Nemate PIB? Pretražite po nazivu ili matičnom broju
            </button>
          ) : (
            <>
              <div className="company-lookup-fallback-head">
                <span>Rezervna pretraga po APR bazi</span>
                <button type="button" className="company-lookup-fallback-btn" onClick={() => { setShowFallback(false); setMessage(''); }}>Vrati PIB pretragu</button>
              </div>
              <CompanySearch
                value={value}
                onSelect={(company) => {
                  onSelect(company);
                  if (company?.pib) setPib(company.pib);
                }}
                label="Naziv firme ili matični broj"
                placeholder="Naziv firme ili matični broj"
                required={required}
                showDetails={showDetails}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
