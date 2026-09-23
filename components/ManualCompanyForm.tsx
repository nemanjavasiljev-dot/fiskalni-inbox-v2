'use client';

import React from 'react';
import { Building2, Loader2, Save, X } from 'lucide-react';
import type { CompanySearchValue } from '@/components/CompanySearch';

type Props = {
  onSaved: (company: CompanySearchValue) => void;
  onCancel: () => void;
  initialPib?: string;
  compact?: boolean;
};

type FormState = {
  registry_kind: 'company' | 'entrepreneur' | 'other';
  name: string;
  short_name: string;
  pib: string;
  registration_number: string;
  legal_form: string;
  registry_status: string;
  address: string;
  city: string;
  municipality: string;
  postal_code: string;
  activity_code: string;
  activity_name: string;
  contact_email: string;
  contact_phone: string;
};

const EMPTY: FormState = {
  registry_kind: 'company',
  name: '',
  short_name: '',
  pib: '',
  registration_number: '',
  legal_form: '',
  registry_status: 'Aktivan',
  address: '',
  city: '',
  municipality: '',
  postal_code: '',
  activity_code: '',
  activity_name: '',
  contact_email: '',
  contact_phone: '',
};

function onlyDigits(value: string, max: number) {
  return value.replace(/\D/g, '').slice(0, max);
}

export default function ManualCompanyForm({ onSaved, onCancel, initialPib = '', compact = false }: Props) {
  const [form, setForm] = React.useState<FormState>({ ...EMPTY, pib: onlyDigits(initialPib, 9) });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.name.trim().length < 2) {
      setError('Unesite pun naziv firme ili preduzetnika.');
      return;
    }
    if (form.pib && form.pib.length !== 9) {
      setError('PIB mora imati tačno 9 cifara.');
      return;
    }
    if (form.registration_number && form.registration_number.length !== 8) {
      setError('Matični broj mora imati tačno 8 cifara.');
      return;
    }
    if (!form.pib && !form.registration_number) {
      setError('Unesite najmanje PIB ili matični broj.');
      return;
    }
    if (form.contact_email && !/^\S+@\S+\.\S+$/.test(form.contact_email.trim())) {
      setError('Kontakt email firme nije ispravan.');
      return;
    }

    setSaving(true);
    try {
      const r = await fetch('/api/companies/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok || !d.company) throw new Error(d.error || 'Ručni unos firme nije sačuvan.');
      onSaved({
        ...(d.company as CompanySearchValue),
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
      });
    } catch (e: any) {
      setError(e?.message || 'Ručni unos firme nije sačuvan.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={`manual-company-form ${compact ? 'compact' : ''}`} onSubmit={submit}>
      <div className="manual-company-head">
        <div>
          <span className="manual-company-kicker">RUČNI UNOS</span>
          <h3>Podaci o firmi</h3>
          <p>Popunite podatke kada automatska APR/NBS pretraga nije dostupna ili ne pronalazi subjekt.</p>
        </div>
        <button type="button" className="manual-company-close" onClick={onCancel} aria-label="Zatvori ručni unos"><X size={19} /></button>
      </div>

      <div className="manual-company-notice">
        <Building2 size={18} />
        <span>Podaci će biti označeni kao <b>ručno uneti</b> i mogu kasnije biti provereni kroz zvanični registar.</span>
      </div>

      <div className="manual-company-grid">
        <div className="field manual-wide">
          <label>Vrsta subjekta *</label>
          <select className="select" value={form.registry_kind} onChange={(e) => set('registry_kind', e.target.value as FormState['registry_kind'])}>
            <option value="company">Privredno društvo</option>
            <option value="entrepreneur">Preduzetnik / PR</option>
            <option value="other">Drugi pravni subjekt</option>
          </select>
        </div>

        <div className="field manual-wide">
          <label>Pun naziv *</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Npr. PRIMER DOO BEOGRAD ili PETAR PETROVIĆ PR..." />
        </div>

        <div className="field manual-wide">
          <label>Skraćeni naziv</label>
          <input className="input" value={form.short_name} onChange={(e) => set('short_name', e.target.value)} placeholder="Opciono" />
        </div>

        <div className="field">
          <label>PIB</label>
          <input className="input" inputMode="numeric" value={form.pib} onChange={(e) => set('pib', onlyDigits(e.target.value, 9))} placeholder="9 cifara" maxLength={9} />
        </div>
        <div className="field">
          <label>Matični broj</label>
          <input className="input" inputMode="numeric" value={form.registration_number} onChange={(e) => set('registration_number', onlyDigits(e.target.value, 8))} placeholder="8 cifara" maxLength={8} />
        </div>

        <div className="field">
          <label>Pravna forma</label>
          <input className="input" value={form.legal_form} onChange={(e) => set('legal_form', e.target.value)} placeholder="DOO, AD, PR..." />
        </div>
        <div className="field">
          <label>Status</label>
          <input className="input" value={form.registry_status} onChange={(e) => set('registry_status', e.target.value)} placeholder="Aktivan" />
        </div>

        <div className="field manual-wide">
          <label>Adresa sedišta</label>
          <input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Ulica i broj" />
        </div>
        <div className="field">
          <label>Mesto / grad</label>
          <input className="input" value={form.city} onChange={(e) => set('city', e.target.value)} />
        </div>
        <div className="field">
          <label>Opština</label>
          <input className="input" value={form.municipality} onChange={(e) => set('municipality', e.target.value)} />
        </div>
        <div className="field">
          <label>Poštanski broj</label>
          <input className="input" inputMode="numeric" value={form.postal_code} onChange={(e) => set('postal_code', onlyDigits(e.target.value, 5))} maxLength={5} />
        </div>
        <div className="field">
          <label>Šifra delatnosti</label>
          <input className="input" inputMode="numeric" value={form.activity_code} onChange={(e) => set('activity_code', onlyDigits(e.target.value, 5))} />
        </div>
        <div className="field manual-wide">
          <label>Naziv delatnosti</label>
          <input className="input" value={form.activity_name} onChange={(e) => set('activity_name', e.target.value)} />
        </div>

        <div className="field">
          <label>Kontakt email firme</label>
          <input className="input" type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} placeholder="office@firma.rs" />
        </div>
        <div className="field">
          <label>Kontakt telefon</label>
          <input className="input" type="tel" value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} placeholder="+381..." />
        </div>
      </div>

      {error && <div className="error manual-company-error">{error}</div>}

      <div className="manual-company-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>Odustani</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <><Loader2 size={17} className="spin" /> Čuvam…</> : <><Save size={17} /> Sačuvaj i nastavi</>}
        </button>
      </div>
    </form>
  );
}
