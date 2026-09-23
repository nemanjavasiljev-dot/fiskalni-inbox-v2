"use client";

import jsQR from "jsqr";
import { Clipboard, ExternalLink, Flashlight, ImagePlus, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type BarcodeDetectorLike = {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

function isFiscalUrl(raw: string) {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" && ["suf.purs.gov.rs", "purs.gov.rs"].some(h => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

function qrKind(raw: string) {
  const v = raw.trim();
  if (/^https?:\/\//i.test(v)) return "Link";
  if (/^WIFI:/i.test(v)) return "Wi-Fi";
  if (/^(BEGIN:VCARD|MECARD:)/i.test(v)) return "Kontakt";
  if (/^mailto:/i.test(v)) return "Email";
  if (/^tel:/i.test(v)) return "Telefon";
  if (/^sms:/i.test(v)) return "SMS";
  if (/^geo:/i.test(v)) return "Lokacija";
  return "Tekst / podatak";
}

export default function QrScanner({ organizationId, onDone }:{
  organizationId?:string; onDone:(result?:any)=>void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const rafRef = useRef<number|undefined>(undefined);
  const detectorRef = useRef<BarcodeDetectorLike|null>(null);
  const processingRef = useRef(false);
  const lastScanRef = useRef(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [message,setMessage] = useState("Pokrećem kameru…");
  const [manual,setManual] = useState("");
  const [saving,setSaving] = useState(false);
  const [detected,setDetected] = useState("");
  const [restartKey,setRestartKey] = useState(0);
  const [torchAvailable,setTorchAvailable] = useState(false);
  const [torchOn,setTorchOn] = useState(false);
  const detectedKind = useMemo(()=>detected ? qrKind(detected) : "",[detected]);

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = undefined;
    streamRef.current?.getTracks().forEach(t=>t.stop());
    streamRef.current = null;
    setTorchAvailable(false);
    setTorchOn(false);
  }

  useEffect(()=>{
    let active = true;
    processingRef.current = false;
    setDetected("");
    setMessage("Pokrećem kameru…");

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera-unavailable");
        const stream = await navigator.mediaDevices.getUserMedia({
          video:{
            facingMode:{ideal:"environment"},
            width:{ideal:2560},
            height:{ideal:1440},
            frameRate:{ideal:30,max:60}
          },
          audio:false
        });
        if (!active) { stream.getTracks().forEach(t=>t.stop()); return; }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        try {
          const caps:any = track.getCapabilities?.() || {};
          setTorchAvailable(Boolean(caps.torch));
          const advanced:any[] = [];
          if (caps.focusMode?.includes?.("continuous")) advanced.push({focusMode:"continuous"});
          if (advanced.length) await track.applyConstraints({advanced} as any);
        } catch {}

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        try {
          if (window.BarcodeDetector) detectorRef.current = new window.BarcodeDetector({formats:["qr_code"]});
        } catch { detectorRef.current = null; }

        setMessage(detectorRef.current
          ? "Brzi QR skener je spreman. Usmerite kameru ka QR kodu."
          : "QR skener je spreman. Držite ceo QR kod u kadru.");
        loop();
      } catch {
        setMessage("Kamera nije dostupna. Dozvolite pristup kameri ili učitajte fotografiju QR koda.");
      }
    }

    async function readFrame() {
      const v = videoRef.current;
      if (!v || !active || processingRef.current || v.readyState < 2 || !v.videoWidth) return;
      processingRef.current = true;
      try {
        if (detectorRef.current) {
          const codes = await detectorRef.current.detect(v as any);
          const value = codes.find(c=>c.rawValue)?.rawValue?.trim();
          if (value) { await handleDetected(value); return; }
        }

        const c = canvasRef.current;
        if (!c) return;
        const max = 1024;
        const scale = Math.min(1,max/v.videoWidth);
        c.width = Math.max(1,Math.round(v.videoWidth*scale));
        c.height = Math.max(1,Math.round(v.videoHeight*scale));
        const ctx = c.getContext("2d",{willReadFrequently:true});
        if (!ctx) return;
        ctx.drawImage(v,0,0,c.width,c.height);
        const image = ctx.getImageData(0,0,c.width,c.height);
        const code = jsQR(image.data,c.width,c.height,{inversionAttempts:"attemptBoth"});
        if (code?.data) { await handleDetected(code.data.trim()); return; }
      } catch {
        // sledeći kadar će pokušati ponovo
      } finally {
        processingRef.current = false;
      }
    }

    function loop(ts=0) {
      if (!active) return;
      if (ts-lastScanRef.current >= 80) {
        lastScanRef.current = ts;
        void readFrame();
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    async function handleDetected(value:string) {
      if (!value || detected === value || saving) return;
      try { navigator.vibrate?.(70); } catch {}
      setDetected(value);
      stopCamera();
      if (isFiscalUrl(value)) {
        await save(value);
      } else {
        setMessage(`QR je očitan (${qrKind(value)}). Nije fiskalni QR, zato nije upisan kao račun.`);
      }
    }

    start();
    return ()=>{ active=false; stopCamera(); };
  // restartKey namerno ponovo pokreće kameru
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[restartKey]);

  async function save(qr:string) {
    if (saving) return;
    setSaving(true);
    setDetected(qr);
    stopCamera();
    if (!organizationId) {
      setMessage("Prvo povežite korisnika sa firmom.");
      setSaving(false);
      return;
    }
    if (!isFiscalUrl(qr)) {
      setMessage(`QR je očitan (${qrKind(qr)}), ali nije fiskalni QR Poreske uprave.`);
      setSaving(false);
      return;
    }
    setMessage("QR je očitan. Proveravam i čuvam fiskalni račun…");
    try {
      const r = await fetch("/api/receipts/scan",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({organization_id:organizationId,qr_url:qr})
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Greška.");
      setMessage(d.duplicate ? "Račun je već u bazi." : `Račun je dodat: ${d.receipt?.category || "Ostalo"}.`);
      setTimeout(()=>onDone(d),500);
    } catch(e:any) {
      setMessage(e.message || "Skeniranje nije uspelo.");
      setSaving(false);
    }
  }

  async function scanImage(file?:File) {
    if (!file) return;
    setMessage("Čitam QR sa fotografije…");
    try {
      const bitmap = await createImageBitmap(file);
      let value = "";
      if (window.BarcodeDetector) {
        try {
          const detector = detectorRef.current || new window.BarcodeDetector({formats:["qr_code"]});
          const codes = await detector.detect(bitmap as any);
          value = codes.find(c=>c.rawValue)?.rawValue?.trim() || "";
        } catch {}
      }
      if (!value) {
        const c = canvasRef.current;
        if (!c) throw new Error("Canvas nije dostupan.");
        const max = 1800;
        const scale = Math.min(1,max/bitmap.width);
        c.width = Math.round(bitmap.width*scale);
        c.height = Math.round(bitmap.height*scale);
        const ctx = c.getContext("2d",{willReadFrequently:true});
        if (!ctx) throw new Error("Canvas nije dostupan.");
        ctx.drawImage(bitmap,0,0,c.width,c.height);
        const image = ctx.getImageData(0,0,c.width,c.height);
        value = jsQR(image.data,c.width,c.height,{inversionAttempts:"attemptBoth"})?.data?.trim() || "";
      }
      bitmap.close();
      if (!value) throw new Error("QR kod nije pronađen na fotografiji.");
      setDetected(value);
      if (isFiscalUrl(value)) await save(value);
      else setMessage(`QR je očitan (${qrKind(value)}). Nije fiskalni QR, zato nije upisan kao račun.`);
    } catch(e:any) {
      setMessage(e?.message || "QR kod nije pronađen na fotografiji.");
    } finally {
      if (imageInputRef.current) imageInputRef.current.value="";
    }
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({advanced:[{torch:next} as any]});
      setTorchOn(next);
    } catch {}
  }

  async function copyDetected() {
    if (!detected) return;
    try { await navigator.clipboard.writeText(detected); setMessage("Sadržaj QR koda je kopiran."); } catch {}
  }

  function restart() {
    setSaving(false);
    setDetected("");
    processingRef.current = false;
    setRestartKey(v=>v+1);
  }

  return <>
    <div className="camera-box qr-camera-box">
      <video ref={videoRef} muted playsInline />
      <canvas ref={canvasRef} style={{display:"none"}}/>
      <div className="qr-frame" aria-hidden="true"><span/><span/><span/><span/></div>
      <div className="camera-msg">{message}</div>
      {torchAvailable && <button type="button" className="qr-torch" onClick={toggleTorch} aria-label="Blic"><Flashlight size={18}/></button>}
    </div>

    {detected && <div className="qr-detected">
      <b>Očitan QR · {detectedKind}</b>
      <div className="mono">{detected}</div>
      <div className="qr-result-actions">
        <button type="button" className="btn" onClick={copyDetected}><Clipboard size={15}/> Kopiraj</button>
        {/^(https?:\/\/)/i.test(detected) && <a className="btn" href={detected} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Otvori</a>}
        {!saving && <button type="button" className="btn" onClick={restart}><RefreshCw size={15}/> Skeniraj ponovo</button>}
      </div>
    </div>}

    <div className="qr-extra-actions">
      <button type="button" className="btn" onClick={()=>imageInputRef.current?.click()} disabled={saving}><ImagePlus size={16}/> Učitaj fotografiju QR-a</button>
      <input ref={imageInputRef} hidden type="file" accept="image/*" onChange={e=>scanImage(e.target.files?.[0])}/>
    </div>

    <div className="field"><label>Ručni unos fiskalnog QR linka</label><input className="input mono" value={manual} onChange={e=>setManual(e.target.value)} placeholder="https://suf.purs.gov.rs/..." /></div>
    <button className="btn btn-primary" style={{width:"100%",marginTop:10}} disabled={!manual||saving} onClick={()=>save(manual)}>Proveri i sačuvaj fiskalni račun</button>
  </>;
}
