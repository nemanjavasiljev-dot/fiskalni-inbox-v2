'use client';

import React from 'react';
import { Building2, CheckCircle2, Loader2, RefreshCw, Search } from 'lucide-react';

export type CompanySearchValue = {
  id: string;
  name: string;
  registration_number: string | null;
  pib: string | null;
  address: string | null;
  city: string | null;
  municipality: string | null;
  postal_code: string | null;
  legal_form: string | null;
  activity_code: string | null;
  activity_name: string | null;
  registry_status: string | null;
  founded_at: string | null;
  apr_source_id: string | null;
  apr_last_sync: string | null;
  source_status?: string;
  manual_review_required?: boolean;
};

type Props = {
  value?: CompanySearchValue | null;
  onSelect: (company: CompanySearchValue | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  compact?: boolean;
  showDetails?: boolean;
  allowRefresh?: boolean;
  className?: string;
};

function fmtSync(v: string | null | undefined) {
  if (!v) return 'nije sinhronizovano';
  try { return new Intl.DateTimeFormat('sr-RS',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)); }
  catch { return v; }
}

export default function CompanySearch({
  value=null,
  onSelect,
  label='Firma',
  placeholder='Naziv firme, PIB ili matični broj',
  disabled=false,
  required=false,
  compact=false,
  showDetails=true,
  allowRefresh=false,
  className=''
}: Props) {
  const [query,setQuery]=React.useState(value?.name||'');
  const [results,setResults]=React.useState<CompanySearchValue[]>([]);
  const [open,setOpen]=React.useState(false);
  const [loading,setLoading]=React.useState(false);
  const [refreshing,setRefreshing]=React.useState(false);
  const [message,setMessage]=React.useState('');
  const requestId=React.useRef(0);

  React.useEffect(()=>{ if(value) setQuery(value.name); },[value?.id]);

  React.useEffect(()=>{
    if(disabled || value) return;
    const q=query.trim();
    const digits=q.replace(/\D/g,'');
    if(q.length<2 && ![8,9].includes(digits.length)){setResults([]);setOpen(false);setMessage('');return;}
    const id=++requestId.current;
    const timer=setTimeout(async()=>{
      setLoading(true);setMessage('');
      try{
        const r=await fetch(`/api/companies/search?q=${encodeURIComponent(q)}`,{cache:'no-store'});
        const d=await r.json();
        if(id!==requestId.current)return;
        if(!r.ok)throw new Error(d.error||'Pretraga firmi trenutno nije dostupna.');
        setResults(d.results||[]);setOpen(true);
        if(!(d.results||[]).length)setMessage(d.warning||'Nije pronađena firma. Proverite naziv, PIB ili matični broj.');
        else if(d.warning)setMessage(d.warning);
      }catch(e:any){if(id===requestId.current){setResults([]);setOpen(true);setMessage(e.message||'Pretraga firmi trenutno nije dostupna. Pokušajte ponovo.');}}
      finally{if(id===requestId.current)setLoading(false);}
    },400);
    return()=>clearTimeout(timer);
  },[query,disabled,value?.id]);

  function choose(company:CompanySearchValue){onSelect(company);setQuery(company.name);setResults([]);setOpen(false);setMessage('');}
  function clear(){onSelect(null);setQuery('');setResults([]);setOpen(false);setMessage('');}

  async function refresh(){
    if(!value?.id)return;
    setRefreshing(true);setMessage('');
    try{
      const r=await fetch(`/api/companies/${value.id}/refresh`,{method:'POST'});const d=await r.json();
      if(!r.ok)throw new Error(d.error||'APR osvežavanje nije uspelo.');
      onSelect(d.company);setQuery(d.company.name);setMessage('APR podaci su osveženi.');
    }catch(e:any){setMessage(e.message||'APR osvežavanje nije uspelo.');}
    finally{setRefreshing(false);}
  }

  return <div className={`company-search ${compact?'compact':''} ${className}`}>
    <label className="company-search-label">{label}{required&&<span aria-hidden="true"> *</span>}</label>
    {!value?<div className="company-search-input-wrap">
      <Search size={17}/><input className="company-search-input" value={query} disabled={disabled} onChange={e=>setQuery(e.target.value)} onFocus={()=>results.length&&setOpen(true)} placeholder={placeholder} autoComplete="off"/>{loading&&<Loader2 className="spin" size={17}/>} 
    </div>:<div className="company-search-selected">
      <div className="company-search-selected-icon"><Building2 size={18}/></div><div className="company-search-selected-copy"><b>{value.name}</b><span>MB: {value.registration_number||'—'} · PIB: {value.pib||'—'}{value.city||value.municipality?` · ${value.city||value.municipality}`:''}</span></div><span className="company-search-apr-badge"><CheckCircle2 size={13}/> {value.source_status==='apr'?'APR':value.manual_review_required?'NBS → APR sync':'Registar'}</span>{!disabled&&<button type="button" className="company-search-change" onClick={clear}>Promeni</button>}
    </div>}
    {open&&!value&&<div className="company-search-dropdown">
      {loading&&<div className="company-search-state"><Loader2 className="spin" size={17}/> Pretražujem centralnu bazu / APR…</div>}
      {!loading&&results.map(c=><button type="button" className="company-search-result" key={c.id} onMouseDown={e=>{e.preventDefault();choose(c)}}><div><b>{c.name}</b><span>MB: {c.registration_number||'—'} | PIB: {c.pib||'—'}</span><small>{c.city||c.municipality||c.address||'—'}</small></div><em className={(c.registry_status||'').toLowerCase().includes('aktiv')?'active':''}>{c.registry_status||'APR podatak'}</em></button>)}
      {!loading&&message&&<div className="company-search-state error-state">{message}</div>}
    </div>}
    {value&&showDetails&&<div className="company-search-details">
      {value.manual_review_required&&<div className="company-search-message"><span>Izvor</span><b>PIB/identitet potvrđen preko zvaničnog NBS registra · APR detalji čekaju sinhronizaciju</b></div>}<div><span>Naziv</span><b>{value.name}</b></div><div><span>Matični broj</span><b>{value.registration_number||'—'}</b></div><div><span>PIB</span><b>{value.pib||'—'}</b></div><div><span>Status</span><b>{value.registry_status||'—'}</b></div><div><span>Adresa</span><b>{value.address||'—'}</b></div><div><span>Mesto / opština</span><b>{[value.city,value.municipality].filter(Boolean).join(' · ')||'—'}</b></div><div><span>Delatnost</span><b>{[value.activity_code,value.activity_name].filter(Boolean).join(' · ')||'—'}</b></div><div><span>Pravna forma</span><b>{value.legal_form||'—'}</b></div>
      <div className="company-search-source"><span>{value.source_status==='apr'?'Podaci iz APR-a':value.manual_review_required?'Zvanični NBS resolver · APR dopuna na sledećoj sinhronizaciji':'Podaci iz centralnog registra'} · poslednja APR sinhronizacija: {fmtSync(value.apr_last_sync)}</span>{allowRefresh&&<button type="button" className="btn" onClick={refresh} disabled={refreshing}><RefreshCw size={14} className={refreshing?'spin':''}/>{refreshing?'Osvežavam…':'Osveži podatke'}</button>}</div>
      {message&&<small className="company-search-message">{message}</small>}
    </div>}
  </div>;
}
