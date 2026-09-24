'use client';

import React from 'react';
import { Building2, CheckCircle2, Loader2, Search, ShieldCheck } from 'lucide-react';
import CompanySearch, { type CompanySearchValue } from '@/components/CompanySearch';
import ManualCompanyForm from '@/components/ManualCompanyForm';

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
  const [manualMode, setManualMode] = React.useState(false);
  const [source, setSource] = React.useState('');
  const [checkedAt, setCheckedAt] = React.useState<string | null>(null);
  const requestId = React.useRef(0);

  React.useEffect(() => {
    if (value?.pib) setPib(value.pib);
    setSource(value?.registry_source || '');
    setCheckedAt(value?.registry_checked_at || null);
  }, [value?.id, value?.pib]);

  React.useEffect(() => {
    const id = ++requestId.current;
    const controller = new AbortController();
    setLoading(false);
    if (disabled || value || showFallback || manualMode) return;
    if (!/^\d{9}$/.test(pib)) {
      setMessage(pib.length > 9 || /\D/.test(pib) ? 'PIB mora imati tačno 9 cifara.' : '');
      setWarning('');
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setMessage('');
      setWarning('');
      try {
        const r = await fetch(`/api/company-lookup?pib=${encodeURIComponent(pib)}`, { cache: 'no-store', signal: controller.signal });
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
        setMessage('Podaci kompanije su pronađeni. Proverite izvor i datum provere.');
      } catch (e: any) {
        if (id !== requestId.current) return;
        setMessage(e.message || 'Automatska provera registra trenutno nije dostupna.');
        if (e.fallback && allowNameMbFallback) setShowFallback(true);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 400);

    return () => { clearTimeout(timer); controller.abort(); requestId.current += 1; };
  }, [pib, disabled, value?.id, showFallback, manualMode, allowNameMbFallback, onSelect]);

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
    setManualMode(false);
  }

  const manualEntry = Boolean(value?.manual_review_required || value?.source_status === 'manual_review' || (value?.registry_source || '').toUpperCase().includes('RUČNI'));
  const verifiedByPib = !manualEntry && Boolean(value?.pib && ((source || value?.registry_source || '').toUpperCase().includes('NBS') || checkedAt || value?.registry_checked_at));

  return (
    <div className={`company-lookup ${compact ? 'compact' : ''} ${className}`}>
      {!value && !showFallback && !manualMode && (
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
              onChange={(e) => setPib(e.target.value.replace(/\s/g, ''))}
              placeholder="Unesite PIB — 9 cifara"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={20}
              autoComplete="off"
              aria-label="PIB kompanije"
            />
            <span className={`company-lookup-counter ${pib.length === 9 ? 'complete' : ''}`}>{pib.length}/9</span>
            {loading && <Loader2 className="spin" size={17} />}
          </div>
          {loading && <div className="company-lookup-status"><Loader2 className="spin" size={15} /> Tražimo podatke kompanije…</div>}
          {!loading && message && <div role="status" className="company-search-state error-state company-lookup-message">{message}</div>}
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
            <span className={`company-lookup-badge ${manualEntry ? 'manual' : ''}`}><ShieldCheck size={14} /> {manualEntry ? 'Ručni unos' : verifiedByPib ? 'Zvanični registri' : 'APR baza'}</span>
            {!disabled && <button type="button" className="company-search-change" onClick={clear}>Promeni</button>}
          </div>

          <div className="company-lookup-confirm">
            <CheckCircle2 size={17} />
            <div><b>{manualEntry ? 'Podaci uneti ručno' : verifiedByPib ? 'Podaci provereni u zvaničnim registrima' : 'Kompanija pronađena u APR bazi'}</b><span>{warning || (manualEntry ? 'Proverite tačnost unetih podataka. FiscalBox će ih kasnije moći povezati sa zvaničnim registrom.' : verifiedByPib ? 'Kompanija je spremna za korišćenje u FiscalBox-u.' : 'PIB možete dopuniti kasnije kada automatska provera bude dostupna.')}</span></div>
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
                <span>Izvor: {manualEntry ? 'Ručni unos' : verifiedByPib ? (source || value.registry_source || 'NBS + APR') : 'APR'} · provera: {manualEntry ? 'čeka proveru' : verifiedByPib ? fmtDate(checkedAt || value.registry_checked_at) : 'lokalna APR sinhronizacija'}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {!value && showFallback && !manualMode && message && <div className="company-search-state error-state company-lookup-message">{message}</div>}

      {!value && !manualMode && allowNameMbFallback && (
        <div className="company-lookup-fallback">
          {!showFallback ? (
            <div className="company-lookup-fallback-actions">
              <a className="company-lookup-fallback-btn" href="https://webappcenter.nbs.rs/PnWebApp/CompanyAccount/CompanyAccountResident" target="_blank" rel="noopener noreferrer">Otvori NBS registar</a>
              <button type="button" className="company-lookup-fallback-btn" onClick={() => { setShowFallback(true); setManualMode(false); setMessage(''); }}>
                Pretraži po nazivu ili matičnom broju
              </button>
              <button type="button" className="company-lookup-manual-btn" onClick={() => { setManualMode(true); setShowFallback(false); setMessage(''); }}>
                Unesi ručno
              </button>
            </div>
          ) : (
            <>
              <div className="company-lookup-fallback-head">
                <span>Rezervna pretraga po APR bazi</span>
                <div className="company-lookup-fallback-head-actions"><button type="button" className="company-lookup-manual-btn" onClick={() => { setManualMode(true); setShowFallback(false); setMessage(''); }}>Unesi ručno</button><button type="button" className="company-lookup-fallback-btn" onClick={() => { setShowFallback(false); setMessage(''); }}>Vrati PIB pretragu</button></div>
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

      {!value && manualMode && (
        <ManualCompanyForm
          initialPib={pib}
          compact={compact}
          onCancel={() => { setManualMode(false); setMessage(''); }}
          onSaved={(company) => {
            onSelect(company);
            if (company.pib) setPib(company.pib);
            setManualMode(false);
            setShowFallback(false);
            setMessage('');
            setSource('RUČNI UNOS');
            setCheckedAt(null);
            setWarning('Podaci su uneti ručno i čekaju naknadnu proveru registra.');
          }}
        />
      )}

    </div>
  );
}
