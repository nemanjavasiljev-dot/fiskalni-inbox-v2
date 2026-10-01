'use client';
import React from 'react';
import { KeyRound, Plus, Save, Trash2, UserCog, X } from 'lucide-react';

type Props={
  organization:any;
  subscription?:any;
  members:any[];
  profiles:any[];
  organizations:any[];
  onClose:()=>void;
};
const profileMap=(profiles:any[])=>new Map(profiles.map((p:any)=>[String(p.user_id),p]));

export default function MasterOrganizationEditor({organization,subscription,members,profiles,organizations,onClose}:Props){
  const accounting=organization.organization_type==='accounting';
  const [busy,setBusy]=React.useState('');
  const [message,setMessage]=React.useState('');
  const [credentials,setCredentials]=React.useState<any>(null);
  const [deleteConfirm,setDeleteConfirm]=React.useState('');
  const [deleteOrgQuery,setDeleteOrgQuery]=React.useState('');
  const [deleteSelectedOrgId,setDeleteSelectedOrgId]=React.useState('');
  const [form,setForm]=React.useState<any>({
    name:organization.name||'',pib:organization.pib||'',registration_number:organization.registration_number||'',
    legal_form:organization.legal_form||'',address:organization.address||'',municipality:organization.municipality||'',
    activity_code:organization.activity_code||'',activity_name:organization.activity_name||'',contact_email:organization.contact_email||'',
    contact_phone:organization.contact_phone||'',plan:subscription?.plan||organization.plan||'basic'
  });
  const [staff,setStaff]=React.useState({full_name:'',email:'',username:'',password:'',access_role:'user'});
  const pmap=profileMap(profiles);
  const orgMembers=members.filter((m:any)=>String(m.organization_id)===String(organization.id)&&['owner','employee'].includes(m.role));
  const normalizedDeleteQuery=deleteOrgQuery.trim().toLowerCase();
  const deleteOrgMatches=normalizedDeleteQuery.length<1?[]:organizations
    .filter((o:any)=>`${o.name||''} ${o.pib||''} ${o.registration_number||''}`.toLowerCase().includes(normalizedDeleteQuery))
    .sort((a:any,b:any)=>String(a.name||'').localeCompare(String(b.name||''),'sr'))
    .slice(0,7);
  const deleteSelectedOrg=organizations.find((o:any)=>String(o.id)===String(deleteSelectedOrgId))||null;
  const deleteTargetConfirmed=String(deleteSelectedOrgId)===String(organization.id);

  async function post(path:string,body:any,key:string){
    setBusy(key);setMessage('');
    try{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Akcija nije uspela.');setMessage(d.message||'Sačuvano.');return d;}
    catch(e:any){setMessage(e.message||'Greška.');return null;}finally{setBusy('');}
  }
  async function save(){const d=await post(`/api/master/organizations/${organization.id}`,form,'save');if(d)setTimeout(()=>location.reload(),600);}
  async function addStaff(){
    const d=await post(`/api/master/organizations/${organization.id}/staff`,{action:'create',...staff},'add-staff');
    if(!d)return;if(d.credentials)setCredentials(d.credentials);else setTimeout(()=>location.reload(),650);
  }
  async function changeRole(m:any,access_role:string){const d=await post(`/api/master/organizations/${organization.id}/staff`,{action:'role',membership_id:m.id,access_role},`role-${m.id}`);if(d)setTimeout(()=>location.reload(),500);}
  async function remove(m:any){if(!confirm('Ukloniti zaposlenog iz ove organizacije? Korisnički nalog neće biti obrisan.'))return;const d=await post(`/api/master/organizations/${organization.id}/staff`,{action:'remove',membership_id:m.id},`remove-${m.id}`);if(d)setTimeout(()=>location.reload(),500);}
  function genPassword(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';let p='Fb!';for(let i=0;i<12;i++)p+=alphabet[Math.floor(Math.random()*alphabet.length)];setStaff(v=>({...v,password:p}));}

  async function deleteOrganization(){
    if(deleteConfirm.trim().toUpperCase()!=='OBRISI'||!deleteTargetConfirmed){
      setMessage('Za trajno brisanje prvo izaberite ovu organizaciju iz ponuđene baze i zatim upišite OBRISI.');
      return;
    }
    const label=accounting?'knjigovođu':'firmu';
    if(!confirm(`TRAJNO obrisati ${label} "${organization.name}"?\n\nBrišu se podaci organizacije, fiskalni računi, dokumenti, pretplata, veze i korisnički nalozi koji ne pripadaju drugoj organizaciji. Ova akcija se ne može poništiti.`))return;
    setBusy('delete-org');setMessage('');
    try{
      const r=await fetch(`/api/master/organizations/${organization.id}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:'OBRISI',organization_name:organization.name})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||'Brisanje nije uspelo.');
      alert((d.message||'Organizacija je obrisana.')+(d.storage_warning?`\n\nUpozorenje: baza je obrisana, ali deo storage fajlova zahteva ručno čišćenje: ${d.storage_warning}`:''));
      onClose();location.reload();
    }catch(e:any){setMessage(e.message||'Brisanje nije uspelo.');}finally{setBusy('');}
  }

  return <div className="master-editor-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}>
    <div className="master-editor-modal">
      <div className="master-editor-head"><div><span className="pill">{accounting?'KNJIGOVOĐA':'FIRMA'} · SUPER ADMIN</span><h2>{organization.name}</h2><p>{organization.pib?`PIB ${organization.pib}`:'Bez PIB-a'} · {organization.registration_number?`MB ${organization.registration_number}`:'bez MB'}</p></div><button type="button" onClick={onClose} aria-label="Zatvori"><X/></button></div>
      {message&&<div className="master46-message" style={{maxWidth:'none',marginBottom:14}}>{message}</div>}
      {credentials&&<div className="master-credentials"><b><KeyRound size={16}/> Novi kredencijali — prikazuju se samo sada</b><span>Email: <strong>{credentials.email}</strong></span><span>Korisničko ime: <strong>{credentials.username}</strong></span><span>Lozinka: <strong>{credentials.password}</strong></span><button className="btn btn-primary" onClick={()=>{navigator.clipboard?.writeText(`FiscalBox\nEmail: ${credentials.email}\nKorisničko ime: ${credentials.username}\nLozinka: ${credentials.password}`);setMessage('Kredencijali su kopirani.')}}>Kopiraj kredencijale</button><button className="btn" onClick={()=>location.reload()}>Završi</button></div>}

      <div className="master-editor-grid">
        <section className="card master46-panel">
          <span className="pill">OSNOVNI PODACI</span><h2>Editovanje organizacije</h2>
          <div className="field"><label>Naziv</label><input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
          <div className="field-grid"><div className="field"><label>PIB</label><input className="input" value={form.pib} onChange={e=>setForm({...form,pib:e.target.value})}/></div><div className="field"><label>Matični broj</label><input className="input" value={form.registration_number} onChange={e=>setForm({...form,registration_number:e.target.value})}/></div></div>
          <div className="field"><label>Pravna forma</label><input className="input" value={form.legal_form} onChange={e=>setForm({...form,legal_form:e.target.value})}/></div>
          <div className="field"><label>Adresa</label><input className="input" value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></div>
          <div className="field-grid"><div className="field"><label>Opština / mesto</label><input className="input" value={form.municipality} onChange={e=>setForm({...form,municipality:e.target.value})}/></div><div className="field"><label>Šifra delatnosti</label><input className="input" value={form.activity_code} onChange={e=>setForm({...form,activity_code:e.target.value})}/></div></div>
          <div className="field"><label>Naziv delatnosti</label><input className="input" value={form.activity_name} onChange={e=>setForm({...form,activity_name:e.target.value})}/></div>
          <div className="field-grid"><div className="field"><label>Email</label><input className="input" type="email" value={form.contact_email} onChange={e=>setForm({...form,contact_email:e.target.value})}/></div><div className="field"><label>Telefon</label><input className="input" value={form.contact_phone} onChange={e=>setForm({...form,contact_phone:e.target.value})}/></div></div>
          {!accounting&&<div className="field"><label>Plan pretplate</label><select className="select" value={form.plan} onChange={e=>setForm({...form,plan:e.target.value})}><option value="basic">BASIC · 1.250 RSD</option><option value="premium">PREMIUM · 1.790 RSD</option></select><small className="muted">Promena se upisuje i u aktivni subscription zapis. Ne generiše automatski uplatu.</small></div>}
          {accounting&&<div className="master46-warning"><b>Knjigovođa je bez pretplate.</b> Ovde se uređuju podaci agencije i zaposleni.</div>}
          <button className="btn btn-primary" disabled={!!busy} onClick={save}><Save size={15}/> {busy==='save'?'Čuvam…':'Sačuvaj podatke'}</button>

          <div className="master-danger-zone">
            <div><span className="pill danger">OPASNA ZONA</span><h3>Trajno obriši {accounting?'knjigovođu':'firmu'}</h3><p className="muted">Ovo briše organizaciju i njene fiskalne račune, dokumente, pretplatu, veze sa knjigovođom/klijentima i storage fajlove. Korisnički nalozi koji nisu član druge organizacije takođe se brišu. Deljeni korisnici ostaju sačuvani.</p></div>
            <div className="field master-danger-org-picker">
              <label>Pronađite i izaberite organizaciju iz FiscalBox baze</label>
              <input
                className="input"
                value={deleteOrgQuery}
                onChange={e=>{setDeleteOrgQuery(e.target.value);setDeleteSelectedOrgId('');}}
                placeholder="Počnite da kucate naziv, PIB ili matični broj"
                autoComplete="off"
              />
              {deleteOrgMatches.length>0&&!deleteSelectedOrgId&&<div className="master-danger-org-results" role="listbox" aria-label="Organizacije iz baze">
                {deleteOrgMatches.map((o:any)=><button key={o.id} type="button" role="option" onClick={()=>{setDeleteSelectedOrgId(String(o.id));setDeleteOrgQuery(String(o.name||''));setMessage('')}}>
                  <span><b>{o.name}</b><small>{o.organization_type==='accounting'?'KNJIGOVOĐA':'FIRMA'}</small></span>
                  <span className="muted">PIB {o.pib||'—'} · MB {o.registration_number||'—'}</span>
                </button>)}
              </div>}
              {normalizedDeleteQuery&&deleteOrgMatches.length===0&&!deleteSelectedOrgId&&<small className="muted">Nema organizacije u FiscalBox bazi za ovu pretragu.</small>}
              {deleteSelectedOrg&&<div className={`master-danger-selected ${deleteTargetConfirmed?'ok':'wrong'}`}>
                <b>{deleteTargetConfirmed?'✓ Izabrana je organizacija koju trenutno uređujete':'⚠ Izabrana je druga organizacija'}</b>
                <span>{deleteSelectedOrg.name} · PIB {deleteSelectedOrg.pib||'—'}</span>
                {!deleteTargetConfirmed&&<small>Za brisanje druge organizacije zatvorite ovaj prozor i otvorite baš tu organizaciju iz liste.</small>}
                <button type="button" className="master46-mini-button" onClick={()=>{setDeleteSelectedOrgId('');setDeleteOrgQuery('')}}>Promeni izbor</button>
              </div>}
            </div>
            <div className="field"><label>Za završnu potvrdu upišite OBRISI</label><input className="input" value={deleteConfirm} onChange={e=>setDeleteConfirm(e.target.value)} placeholder="OBRISI"/></div>
            <button className="btn danger-outline" disabled={!!busy||deleteConfirm.trim().toUpperCase()!=='OBRISI'||!deleteTargetConfirmed} onClick={deleteOrganization}><Trash2 size={15}/> {busy==='delete-org'?'Brišem…':accounting?'Trajno obriši knjigovođu':'Trajno obriši firmu'}</button>
          </div>
        </section>

        <section className="card master46-panel">
          <span className="pill"><UserCog size={13}/> ZAPOSLENI I ADMINI</span><h2>Članovi organizacije</h2>
          <div className="master-staff-list">{orgMembers.map((m:any)=>{const p:any=pmap.get(String(m.user_id))||{};const owner=String(m.user_id)===String(organization.owner_user_id)||m.role==='owner';const access=owner?'admin':(accounting?(m.accounting_access_role||m.organization_access_role||'user'):(m.organization_access_role||'user'));return <div key={m.id}><div><b>{p.full_name||p.username||p.auth_email||'Korisnik'}</b><span>{p.auth_email||'—'} · {owner?'VLASNIK':'ZAPOSLENI'}</span></div><div className="actions"><select className="select" value={access} disabled={owner||!!busy} onChange={e=>changeRole(m,e.target.value)}><option value="admin">ADMIN</option><option value="user">USER</option></select>{!owner&&<button className="master46-mini-button danger-outline" disabled={!!busy} onClick={()=>remove(m)}><Trash2 size={13}/> Ukloni</button>}</div></div>})}</div>
          <div className="master-add-staff"><h3><Plus size={17}/> Dodaj zaposlenog / admina</h3><div className="field"><label>Ime i prezime</label><input className="input" value={staff.full_name} onChange={e=>setStaff({...staff,full_name:e.target.value})}/></div><div className="field"><label>Email</label><input className="input" type="email" value={staff.email} onChange={e=>setStaff({...staff,email:e.target.value})}/></div><div className="field-grid"><div className="field"><label>Korisničko ime (opciono)</label><input className="input" value={staff.username} onChange={e=>setStaff({...staff,username:e.target.value})} placeholder="automatski ako ostane prazno"/></div><div className="field"><label>Privilegija</label><select className="select" value={staff.access_role} onChange={e=>setStaff({...staff,access_role:e.target.value})}><option value="user">USER</option><option value="admin">ADMIN</option></select></div></div><div className="field"><label>Privremena lozinka (opciono)</label><div style={{display:'flex',gap:8}}><input className="input" value={staff.password} onChange={e=>setStaff({...staff,password:e.target.value})} placeholder="sistem generiše ako je prazno"/><button className="btn" type="button" onClick={genPassword}>Generiši</button></div></div><button className="btn btn-primary" disabled={!staff.email||!!busy} onClick={addStaff}><Plus size={15}/> {busy==='add-staff'?'Dodajem…':'Dodaj u organizaciju'}</button><p className="muted">Ako email već pripada FiscalBox korisniku, nalog se ne duplira — korisnik se samo dodeljuje ovoj organizaciji. Novi nalog se kreira sa potvrđenim emailom i generisanim kredencijalima.</p></div>
        </section>
      </div>
    </div>
  </div>;
}
