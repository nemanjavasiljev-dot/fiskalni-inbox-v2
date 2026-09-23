"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, File as FileIcon, FileText, FolderOpen, Pencil, Search, Send, Upload, X } from "lucide-react";
import QrScanner from "@/components/QrScanner";
import UserBottomNav from "@/components/UserBottomNav";
import DocumentScanner from "@/components/DocumentScanner";
import BrandWordmark from "@/components/BrandWordmark";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";

const dt = (v: string) => new Intl.DateTimeFormat("sr-RS", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));
const bytes = (v: number) => v < 1024 ? `${v} B` : v < 1048576 ? `${(v / 1024).toFixed(1)} KB` : `${(v / 1048576).toFixed(1)} MB`;
function splitFileName(name:string) {
  const idx=name.lastIndexOf(".");
  if(idx<=0) return {base:name,ext:""};
  return {base:name.slice(0,idx),ext:name.slice(idx)};
}
function safeUserName(value:string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g,"-").replace(/\s+/g," ").slice(0,100);
}
function renamedFile(file:File, wanted:string) {
  const {base,ext}=splitFileName(file.name);
  const next=safeUserName(wanted)||base||"dokument";
  return new File([file], `${next}${ext}`, {type:file.type,lastModified:file.lastModified});
}

type PendingFile = { file:File; name:string; rename:boolean };
type PendingAdd = { source:"camera"|"upload"; items:PendingFile[] };


export default function FilesWorkspace({ profile, organizations, activeOrg, initialDocuments }: any) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"inbox" | "sent">(activeOrg.role === "accountant" ? "sent" : "inbox");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [scanQr, setScanQr] = useState(false);
  const [scanDocument, setScanDocument] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [pendingAdd,setPendingAdd] = useState<PendingAdd|null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const isAccountant = activeOrg.role === "accountant";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((d: any) => {
      if (!isAccountant && d.status !== tab) return false;
      if (isAccountant && d.status !== "sent") return false;
      if (!q) return true;
      return [d.file_name, d.mime_type, d.source].some((v: any) => String(v || "").toLowerCase().includes(q));
    });
  }, [documents, query, tab, isAccountant]);

  async function uploadBatch(batch: File[], source: "scan" | "camera" | "upload") {
    if (!batch.length) return;
    if(batch.length>10){setMessage("Možete dodati najviše 10 fajlova odjednom.");return;}
    if(batch.some(f=>f.size>20*1024*1024)){setMessage("Maksimalna veličina jednog fajla je 20 MB.");return;}
    setBusy(true); setMessage("");
    const storage=createBrowserSupabase();
    try {
      const added:any[]=[];
      for(const file of batch){
        const tokenResponse=await fetch("/api/documents/upload",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organization_id:activeOrg.organization_id,file_name:file.name,mime_type:file.type,size_bytes:file.size,source})});
        const signed=await tokenResponse.json();
        if(!tokenResponse.ok) throw new Error(signed.error||"Upload nije uspeo.");
        const {error:uploadError}=await storage.storage.from("documents").uploadToSignedUrl(signed.path,signed.token,file,{contentType:file.type||"application/octet-stream"});
        if(uploadError) throw new Error(uploadError.message);
        const registerResponse=await fetch("/api/documents/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organization_id:activeOrg.organization_id,storage_path:signed.path,file_name:file.name,mime_type:file.type,size_bytes:file.size,source})});
        const registered=await registerResponse.json();
        if(!registerResponse.ok) throw new Error(registered.error||"Evidentiranje dokumenta nije uspelo.");
        added.push(registered.document);
      }
      setDocuments((old:any[])=>[...added,...old]); setTab("inbox"); setMessage(`${added.length} dokument(a) je dodato.`);
    } catch (e:any) { setMessage(e.message || "Upload nije uspeo."); }
    finally { setBusy(false); if (photoInput.current) photoInput.current.value=""; if (uploadInput.current) uploadInput.current.value=""; }
  }

  function prepareUpload(files: FileList | null, source: "camera" | "upload") {
    if (!files?.length) return;
    const list=Array.from(files);
    if(list.length>10){setMessage("Možete dodati najviše 10 fajlova odjednom.");return;}
    if(list.some(f=>f.size>20*1024*1024)){setMessage("Maksimalna veličina jednog fajla je 20 MB.");return;}
    setMessage("");
    setPendingAdd({
      source,
      items:list.map(file=>{
        const {base}=splitFileName(file.name);
        return {file,name:source==="camera"?`Fotografija ${new Intl.DateTimeFormat("sr-RS",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date()).replace(/[.:]/g,"-")}`:base,rename:source==="camera"};
      })
    });
  }

  function updatePending(index:number,patch:Partial<PendingFile>) {
    setPendingAdd(old=>old?{...old,items:old.items.map((item,i)=>i===index?{...item,...patch}:item)}:old);
  }

  async function confirmPendingAdd() {
    if(!pendingAdd) return;
    const prepared=pendingAdd.items.map(item=>item.rename?renamedFile(item.file,item.name):item.file);
    if(pendingAdd.source==="camera" && !pendingAdd.items[0]?.name.trim()){setMessage("Upišite naziv fotografije.");return;}
    const source=pendingAdd.source;
    setPendingAdd(null);
    await uploadBatch(prepared,source);
  }

  async function sendSelected() {
    if (!selected.length) return;
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/documents/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organization_id: activeOrg.organization_id, ids: selected }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Slanje nije uspelo.");
      const now = new Date().toISOString();
      setDocuments((old: any[]) => old.map((d: any) => selected.includes(d.id) ? { ...d, status: "sent", sent_at: now } : d));
      setSelected([]); setMessage(`${data.sent} dokument(a) poslato knjigovođi.`); setTab("sent");
    } catch (e: any) { setMessage(e.message || "Slanje nije uspelo."); }
    finally { setBusy(false); }
  }

  function toggle(id: string) { setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]); }
  function iconFor(d: any) { return String(d.mime_type || "").startsWith("image/") ? <FileIcon size={20}/> : <FileText size={20}/>; }

  return <div className={`app-shell ${!isAccountant ? "with-bottom-nav" : ""}`}>
    <header className="appbar"><div className="container appbar-in"><a className="brand" href="/app"><span className="logo">F</span><BrandWordmark/></a><div className="actions"><span className="muted" style={{alignSelf:"center",fontSize:12}}>{profile.username}</span><form method="post" action="/api/auth/logout"><button className="btn">Odjava</button></form></div></div></header>
    <main className="container app-main">
      <div className="app-head files-head"><div><span className="pill">{isAccountant ? "DOKUMENTI KLIJENTA" : "FAJLOVI"}</span><h1>{activeOrg.name}</h1><p className="muted">{isAccountant ? "Dokumenti koje vam je klijent poslao." : "Skenirajte, fotografišite ili dodajte dokument i prosledite ga knjigovođi."}</p></div><div className="actions">{organizations.length>1 && <select className="select" value={activeOrg.organization_id} onChange={e=>router.push(`/app/files?org=${e.target.value}`)}>{organizations.map((o:any)=><option key={o.organization_id} value={o.organization_id}>{o.name}</option>)}</select>}</div></div>

      {!isAccountant && <div className="grid file-action-grid">
        <button className="card file-action" onClick={()=>setScanDocument(true)} disabled={busy}><FileText/><div><b>Skeniraj dokument</b><span>Otvori kameru i snimi dokument</span></div></button>
        <button className="card file-action" onClick={()=>photoInput.current?.click()} disabled={busy}><Camera/><div><b>Fotografiši</b><span>Dodaj fotografiju računa ili dokumenta</span></div></button>
        <button className="card file-action" onClick={()=>uploadInput.current?.click()} disabled={busy}><Upload/><div><b>Dodaj fajl</b><span>PDF, Word, Excel, XML, CSV, slike…</span></div></button>
        <input ref={photoInput} hidden type="file" accept="image/*" capture="environment" onChange={e=>prepareUpload(e.target.files,"camera")}/>
        <input ref={uploadInput} hidden type="file" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.xml,.txt,.zip" onChange={e=>prepareUpload(e.target.files,"upload")}/>
      </div>}

      {message && <div className="file-message">{message}</div>}

      <div className="card files-panel">
        <div className="files-toolbar">
          <div className="files-tabs">{!isAccountant && <button className={tab==="inbox"?"active":""} onClick={()=>setTab("inbox")}>Fajlovi</button>}<button className={tab==="sent"?"active":""} onClick={()=>setTab("sent")}>{isAccountant ? "Primljeni dokumenti" : "Poslati dokumenti"}</button></div>
          <div className="files-search"><Search size={18}/><input ref={searchInput} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pretraži fajlove…"/></div>
        </div>

        {!isAccountant && tab==="inbox" && <div className="send-bar"><div><span>{selected.length ? `${selected.length} označeno` : "Označite dokumente koje šaljete knjigovođi"}</span></div><button className="btn btn-primary" disabled={!selected.length||busy} onClick={sendSelected}><Send size={17}/> Pošalji knjigovođi</button></div>}

        <div className="files-list">
          {filtered.map((d:any)=><div className="file-row" key={d.id}>
            {!isAccountant && tab==="inbox" && <label className="file-check"><input type="checkbox" checked={selected.includes(d.id)} onChange={()=>toggle(d.id)}/><span/></label>}
            <div className="file-type-icon">{iconFor(d)}</div>
            <div className="file-main"><b>{d.file_name}</b><span>{bytes(Number(d.size_bytes||0))} · {d.source==="scan"?"Skenirano":d.source==="camera"?"Fotografija":"Fajl"} · {dt(d.created_at)}</span>{d.sent_at&&<small>Poslato: {dt(d.sent_at)}</small>}</div>
            <div className="file-status"><span className={`badge ${d.status==="sent"?"":"warn"}`}>{d.status==="sent"?"POSLATO":"SPREMNO"}</span><a className="btn file-download" href={`/api/documents/${d.id}/download`}>Preuzmi</a></div>
          </div>)}
          {filtered.length===0 && <div className="files-empty"><FolderOpen size={34}/><b>Nema dokumenata</b><span>{query?"Nema rezultata za ovu pretragu.":isAccountant?"Klijent još nije poslao dokumente.":tab==="sent"?"Još nema poslatih dokumenata.":"Dodajte prvi dokument iznad."}</span></div>}
        </div>
      </div>
    </main>

    {!isAccountant && pendingAdd && <div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setPendingAdd(null)}}><div className="modal file-name-modal">
      <div className="modal-head"><div><span className="pill">{pendingAdd.source==="camera"?"FOTOGRAFIJA":"DODAJ DOKUMENT"}</span><h2>{pendingAdd.source==="camera"?"Naziv fotografije":"Naziv dokumenta"}</h2></div><button className="btn" onClick={()=>setPendingAdd(null)}><X size={16}/> Zatvori</button></div>
      {pendingAdd.source==="camera" ? <>
        <p className="muted">Pre čuvanja upišite naziv fotografije.</p>
        <div className="field"><label>Naziv fotografije *</label><input className="input" autoFocus value={pendingAdd.items[0]?.name||""} onChange={e=>updatePending(0,{name:e.target.value,rename:true})} maxLength={100} placeholder="npr. Račun za gorivo"/></div>
      </> : <>
        <p className="muted">Možete zadržati originalni naziv ili preimenovati dokument pre čuvanja.</p>
        <div className="rename-file-list">{pendingAdd.items.map((item,index)=><div className="rename-file-row" key={`${item.file.name}-${index}`}>
          <div className="rename-file-original"><FileText size={18}/><div><b>{item.file.name}</b><span>{bytes(item.file.size)}</span></div></div>
          <label className="rename-toggle"><input type="checkbox" checked={item.rename} onChange={e=>updatePending(index,{rename:e.target.checked})}/><Pencil size={15}/> Preimenuj</label>
          {item.rename && <input className="input" value={item.name} onChange={e=>updatePending(index,{name:e.target.value})} maxLength={100} placeholder="Novi naziv dokumenta"/>}
        </div>)}</div>
      </>}
      <div className="document-scanner-actions"><button className="btn" onClick={()=>setPendingAdd(null)}>Odustani</button><button className="btn btn-primary" onClick={confirmPendingAdd} disabled={busy || (pendingAdd.source==="camera"&&!pendingAdd.items[0]?.name.trim())}><Check size={16}/> {pendingAdd.source==="camera"?"Sačuvaj fotografiju":`Dodaj ${pendingAdd.items.length} dokument(a)`}</button></div>
    </div></div>}

    {!isAccountant && scanDocument && <div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setScanDocument(false)}}><div className="modal document-scanner-modal"><DocumentScanner onClose={()=>setScanDocument(false)} onCapture={async(file)=>{setScanDocument(false);await uploadBatch([file],"scan")}}/></div></div>}
    {!isAccountant && scanQr && <div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setScanQr(false)}}><div className="modal qr-modal"><div className="modal-head"><div><span className="pill">NOVI RAČUN</span><h2>QR skener</h2></div><button className="btn" onClick={()=>setScanQr(false)}>Zatvori</button></div><QrScanner organizationId={activeOrg.organization_id} onDone={()=>{setScanQr(false);router.refresh()}}/></div></div>}
    {!isAccountant && moreOpen && <div className="bottom-sheet-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setMoreOpen(false)}}><div className="bottom-sheet"><div className="bottom-sheet-handle"/><div className="bottom-sheet-head"><div><span className="pill">VIŠE</span><h3>Opcije naloga</h3></div><button className="btn" onClick={()=>setMoreOpen(false)}>Zatvori</button></div><div className="more-list"><div className="more-info"><span>Firma</span><b>{activeOrg.name}</b></div><div className="more-info"><span>Paket</span><b>{String(activeOrg.plan||"basic").toUpperCase()}</b></div><button className="more-action" onClick={()=>router.push(`/app?org=${activeOrg.organization_id}`)}>Fiskalni računi <b>→</b></button><button className="more-action" onClick={()=>router.push("/app/billing")}>Moji računi <b>→</b></button></div></div></div>}
    {!isAccountant && <UserBottomNav active="files" onHome={()=>router.push(`/app?org=${activeOrg.organization_id}`)} onSearch={()=>searchInput.current?.focus()} onScan={()=>setScanQr(true)} onFiles={()=>{}} onMore={()=>setMoreOpen(true)}/>} 
  </div>;
}
