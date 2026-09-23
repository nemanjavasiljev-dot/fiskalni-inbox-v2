"use client";

import jsQR from "jsqr";
import { Clipboard, ExternalLink, Flashlight, ImagePlus, RefreshCw, ScanLine } from "lucide-react";
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

function makeCanvas(source: CanvasImageSource, sourceWidth:number, sourceHeight:number, max:number, crop=1) {
  const cropW=Math.max(1,Math.round(sourceWidth*crop));
  const cropH=Math.max(1,Math.round(sourceHeight*crop));
  const sx=Math.max(0,Math.round((sourceWidth-cropW)/2));
  const sy=Math.max(0,Math.round((sourceHeight-cropH)/2));
  const scale=Math.min(1,max/Math.max(cropW,cropH));
  const c=document.createElement("canvas");
  c.width=Math.max(1,Math.round(cropW*scale));
  c.height=Math.max(1,Math.round(cropH*scale));
  const ctx=c.getContext("2d",{willReadFrequently:true});
  if(!ctx)return null;
  ctx.drawImage(source,sx,sy,cropW,cropH,0,0,c.width,c.height);
  return c;
}

function jsQrDecode(canvas:HTMLCanvasElement) {
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  if(!ctx)return "";
  const image=ctx.getImageData(0,0,canvas.width,canvas.height);
  let result=jsQR(image.data,canvas.width,canvas.height,{inversionAttempts:"attemptBoth"});
  if(result?.data)return result.data.trim();

  // Low contrast / faded thermal receipts: contrast + grayscale pass.
  const enhanced=new Uint8ClampedArray(image.data);
  for(let i=0;i<enhanced.length;i+=4){
    const y=0.299*enhanced[i]+0.587*enhanced[i+1]+0.114*enhanced[i+2];
    const v=Math.max(0,Math.min(255,(y-128)*1.75+128));
    enhanced[i]=enhanced[i+1]=enhanced[i+2]=v;
  }
  result=jsQR(enhanced,canvas.width,canvas.height,{inversionAttempts:"attemptBoth"});
  if(result?.data)return result.data.trim();

  // Hard threshold helps damaged/blurred black-white printouts.
  for(let i=0;i<enhanced.length;i+=4){
    const v=enhanced[i] > 150 ? 255 : 0;
    enhanced[i]=enhanced[i+1]=enhanced[i+2]=v;
  }
  result=jsQR(enhanced,canvas.width,canvas.height,{inversionAttempts:"attemptBoth"});
  return result?.data?.trim() || "";
}

export default function QrScanner({ organizationId, onDone }:{
  organizationId?:string; onDone:(result?:any)=>void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const rafRef = useRef<number|undefined>(undefined);
  const detectorRef = useRef<BarcodeDetectorLike|null>(null);
  const zxingRef = useRef<any>(null);
  const processingRef = useRef(false);
  const lastScanRef = useRef(0);
  const frameRef = useRef(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const detectedRef = useRef("");
  const [message,setMessage] = useState("Pokrećem kameru…");
  const [manual,setManual] = useState("");
  const [saving,setSaving] = useState(false);
  const [detected,setDetected] = useState("");
  const [restartKey,setRestartKey] = useState(0);
  const [torchAvailable,setTorchAvailable] = useState(false);
  const [torchOn,setTorchOn] = useState(false);
  const [engine,setEngine] = useState("Native + jsQR");
  const detectedKind = useMemo(()=>detected ? qrKind(detected) : "",[detected]);

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = undefined;
    streamRef.current?.getTracks().forEach(t=>t.stop());
    streamRef.current = null;
    setTorchAvailable(false);
    setTorchOn(false);
  }

  async function decodeZxing(canvas:HTMLCanvasElement) {
    try{
      const reader=zxingRef.current;
      if(!reader)return "";
      const result=reader.decodeFromCanvasElement(canvas);
      return String(result?.getText?.() || result?.text || "").trim();
    }catch{return "";}
  }

  async function multiDecode(source:CanvasImageSource,w:number,h:number,photo=false) {
    // Multiple independent decoders + multiple crops/resolutions.
    const configs=photo
      ? [{max:2800,crop:1},{max:2200,crop:.92},{max:1800,crop:.78},{max:1200,crop:1}]
      : [{max:1400,crop:1},{max:1200,crop:.84}];
    for(const cfg of configs){
      const c=makeCanvas(source,w,h,cfg.max,cfg.crop);
      if(!c)continue;
      const js=jsQrDecode(c);
      if(js)return {value:js,engine:"jsQR multi-pass"};
      const zx=await decodeZxing(c);
      if(zx)return {value:zx,engine:"ZXing"};
    }
    return {value:"",engine:""};
  }

  useEffect(()=>{
    let active = true;
    processingRef.current = false;
    detectedRef.current="";
    setDetected("");
    setMessage("Pokrećem kameru…");

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera-unavailable");
        const stream = await navigator.mediaDevices.getUserMedia({
          video:{
            facingMode:{ideal:"environment"},
            width:{ideal:3840,min:1280},
            height:{ideal:2160,min:720},
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
          if (caps.exposureMode?.includes?.("continuous")) advanced.push({exposureMode:"continuous"});
          if (caps.whiteBalanceMode?.includes?.("continuous")) advanced.push({whiteBalanceMode:"continuous"});
          if (advanced.length) await track.applyConstraints({advanced} as any);
        } catch {}

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        try {
          if (window.BarcodeDetector) detectorRef.current = new window.BarcodeDetector({formats:["qr_code"]});
        } catch { detectorRef.current = null; }

        // Third independent QR engine. Loaded lazily so the scanner opens immediately.
        import("@zxing/browser").then((mod:any)=>{
          try{
            zxingRef.current=new mod.BrowserMultiFormatReader();
            if(active)setEngine(detectorRef.current?"Native + jsQR + ZXing":"jsQR + ZXing");
          }catch{}
        }).catch(()=>{});

        setMessage("Skener je spreman. Približite QR kod i držite ga mirno 1–2 sekunde.");
        loop();
      } catch {
        setMessage("Kamera nije dostupna. Dozvolite pristup kameri ili učitajte fotografiju QR koda.");
      }
    }

    async function readFrame() {
      const v = videoRef.current;
      if (!v || !active || processingRef.current || v.readyState < 2 || !v.videoWidth) return;
      processingRef.current = true;
      frameRef.current++;
      try {
        // 1) Browser/OS native decoder – najbrži kada postoji.
        if (detectorRef.current) {
          const codes = await detectorRef.current.detect(v as any);
          const value = codes.find(c=>c.rawValue)?.rawValue?.trim();
          if (value) { setEngine("Native BarcodeDetector"); await handleDetected(value); return; }
        }

        // 2) jsQR on every pass; 3) ZXing is included in multiDecode.
        const decoded=await multiDecode(v,v.videoWidth,v.videoHeight,false);
        if(decoded.value){setEngine(decoded.engine);await handleDetected(decoded.value);return;}
      } catch {
        // next frame tries again
      } finally {
        processingRef.current = false;
      }
    }

    function loop(ts=0) {
      if (!active) return;
      if (ts-lastScanRef.current >= 70) {
        lastScanRef.current = ts;
        void readFrame();
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    async function handleDetected(value:string) {
      if (!value || detectedRef.current === value || savingRef.current) return;
      detectedRef.current=value;
      try { navigator.vibrate?.(90); } catch {}
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[restartKey]);

  async function save(qr:string) {
    if (savingRef.current) return;
    savingRef.current=true;
    setSaving(true);
    detectedRef.current=qr;
    setDetected(qr);
    stopCamera();
    if (!organizationId) {
      setMessage("Prvo povežite korisnika sa firmom.");
      savingRef.current=false;setSaving(false);return;
    }
    if (!isFiscalUrl(qr)) {
      setMessage(`QR je očitan (${qrKind(qr)}), ali nije fiskalni QR Poreske uprave.`);
      savingRef.current=false;setSaving(false);return;
    }
    setMessage("QR je očitan. Proveravam račun kod Poreske uprave i čuvam ga…");
    try {
      const r = await fetch("/api/receipts/scan",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({organization_id:organizationId,qr_url:qr})
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Greška.");
      setMessage(d.duplicate ? "Račun je već u bazi." : d.status==="provereno" ? "Račun je dodat i verifikovan kod Poreske uprave." : "Račun je dodat, ali verifikaciju treba proveriti.");
      setTimeout(()=>onDone(d),650);
    } catch(e:any) {
      setMessage(e.message || "Skeniranje nije uspelo.");
      savingRef.current=false;setSaving(false);
    }
  }

  async function scanImage(file?:File) {
    if (!file) return;
    setMessage("Analiziram fotografiju kroz više QR čitača…");
    try {
      const bitmap = await createImageBitmap(file,{imageOrientation:"from-image"});
      let value = "";
      let usedEngine="";

      if (window.BarcodeDetector) {
        try {
          const detector = detectorRef.current || new window.BarcodeDetector({formats:["qr_code"]});
          const codes = await detector.detect(bitmap as any);
          value = codes.find(c=>c.rawValue)?.rawValue?.trim() || "";
          if(value)usedEngine="Native BarcodeDetector";
        } catch {}
      }
      if (!value) {
        const decoded=await multiDecode(bitmap,bitmap.width,bitmap.height,true);
        value=decoded.value;usedEngine=decoded.engine;
      }
      bitmap.close();
      if (!value) throw new Error("QR kod nije pronađen. Probajte oštriju fotografiju bez odsjaja i sa celim QR kodom u kadru.");
      setEngine(usedEngine||engine);
      detectedRef.current=value;
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
    savingRef.current=false;
    setSaving(false);
    detectedRef.current="";
    setDetected("");
    processingRef.current = false;
    setRestartKey(v=>v+1);
  }

  return <>
    <div className="camera-box qr-camera-box">
      <video ref={videoRef} muted playsInline />
      <div className="qr-frame" aria-hidden="true"><span/><span/><span/><span/></div>
      <div className="camera-msg">{message}</div>
      <div className="qr-engine"><ScanLine size={13}/> {engine}</div>
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

    <div className="scanner-info"><ScanLine size={16}/><span>Skener paralelno koristi nativni browser čitač, jsQR sa obradom slabog kontrasta i ZXing fallback. Za blede termalne račune uključite blic ili učitajte fotografiju.</span></div>

    <div className="field"><label>Ručni unos fiskalnog QR linka</label><input className="input mono" value={manual} onChange={e=>setManual(e.target.value)} placeholder="https://suf.purs.gov.rs/..." /></div>
    <button className="btn btn-primary" style={{width:"100%",marginTop:10}} disabled={!manual||saving} onClick={()=>save(manual)}>Proveri i sačuvaj fiskalni račun</button>
  </>;
}
