"use client";

import jsQR from "jsqr";
import { Clipboard, ExternalLink, Flashlight, ImagePlus, RefreshCw, ScanLine, ZoomIn } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type BarcodeDetectorLike = {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

type ZoomCaps = { min:number; max:number; step?:number } | null;

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

function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v));}

function makeCanvas(source: CanvasImageSource, sourceWidth:number, sourceHeight:number, max:number, crop=1, sharpen=false) {
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
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  ctx.drawImage(source,sx,sy,cropW,cropH,0,0,c.width,c.height);
  if(sharpen){
    // A light contrast pass helps tiny/faded thermal QR modules without destroying edges.
    const image=ctx.getImageData(0,0,c.width,c.height);
    const d=image.data;
    for(let i=0;i<d.length;i+=4){
      const y=.299*d[i]+.587*d[i+1]+.114*d[i+2];
      const gain=y<105?1.18:y>210?1.08:1.28;
      d[i]=clamp((d[i]-128)*gain+128,0,255);
      d[i+1]=clamp((d[i+1]-128)*gain+128,0,255);
      d[i+2]=clamp((d[i+2]-128)*gain+128,0,255);
    }
    ctx.putImageData(image,0,0);
  }
  return c;
}

function jsQrDecode(canvas:HTMLCanvasElement) {
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  if(!ctx)return "";
  const image=ctx.getImageData(0,0,canvas.width,canvas.height);
  let result=jsQR(image.data,canvas.width,canvas.height,{inversionAttempts:"attemptBoth"});
  if(result?.data)return result.data.trim();

  const enhanced=new Uint8ClampedArray(image.data);
  for(let i=0;i<enhanced.length;i+=4){
    const y=0.299*enhanced[i]+0.587*enhanced[i+1]+0.114*enhanced[i+2];
    const v=Math.max(0,Math.min(255,(y-128)*1.9+128));
    enhanced[i]=enhanced[i+1]=enhanced[i+2]=v;
  }
  result=jsQR(enhanced,canvas.width,canvas.height,{inversionAttempts:"attemptBoth"});
  if(result?.data)return result.data.trim();

  // Two thresholds because thermal paper often has uneven background brightness.
  for(const threshold of [142,172]){
    const thresholded=new Uint8ClampedArray(enhanced);
    for(let i=0;i<thresholded.length;i+=4){
      const v=thresholded[i] > threshold ? 255 : 0;
      thresholded[i]=thresholded[i+1]=thresholded[i+2]=v;
    }
    result=jsQR(thresholded,canvas.width,canvas.height,{inversionAttempts:"attemptBoth"});
    if(result?.data)return result.data.trim();
  }
  return "";
}

export default function QrScanner({ organizationId, onDone }:{
  organizationId?:string; onDone:(result?:any)=>void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const rafRef = useRef<number|undefined>(undefined);
  const detectorRef = useRef<BarcodeDetectorLike|null>(null);
  const zxingRef = useRef<any>(null);
  const nimiqRef = useRef<any>(null);
  const nimiqEngineRef = useRef<any>(null);
  const processingRef = useRef(false);
  const lastScanRef = useRef(0);
  const frameRef = useRef(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const detectedRef = useRef("");
  const zoomCapsRef = useRef<ZoomCaps>(null);
  const zoomIndexRef = useRef(0);
  const digitalCropRef = useRef(1);
  const autoZoomTimerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const [message,setMessage] = useState("Pokrećem kameru…");
  const [manual,setManual] = useState("");
  const [saving,setSaving] = useState(false);
  const [detected,setDetected] = useState("");
  const [restartKey,setRestartKey] = useState(0);
  const [torchAvailable,setTorchAvailable] = useState(false);
  const [torchOn,setTorchOn] = useState(false);
  const [zoomAvailable,setZoomAvailable] = useState(false);
  const [zoomLevel,setZoomLevel] = useState(1);
  const [engine,setEngine] = useState("Pripremam QR engine…");
  const detectedKind = useMemo(()=>detected ? qrKind(detected) : "",[detected]);

  function clearAutoZoom(){
    if(autoZoomTimerRef.current)clearInterval(autoZoomTimerRef.current);
    autoZoomTimerRef.current=null;
  }

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = undefined;
    clearAutoZoom();
    streamRef.current?.getTracks().forEach(t=>t.stop());
    streamRef.current = null;
    setTorchAvailable(false);
    setTorchOn(false);
  }

  async function applyZoom(value:number){
    const track=streamRef.current?.getVideoTracks()[0];
    const caps=zoomCapsRef.current;
    if(!track||!caps)return false;
    const next=clamp(value,caps.min,caps.max);
    try{
      await track.applyConstraints({advanced:[{zoom:next} as any]});
      setZoomLevel(next);
      return true;
    }catch{return false;}
  }

  function startAdaptiveAutoZoom(){
    clearAutoZoom();
    const caps=zoomCapsRef.current;
    const hardwareSteps=caps ? [1,1.25,1.5,1.8,2.2,2.8,3.5,caps.max]
      .map(v=>clamp(v,caps.min,caps.max)).filter((v,i,a)=>i===0||Math.abs(v-a[i-1])>.08) : [];
    const digitalSteps=[1,.86,.72,.60,.50];
    zoomIndexRef.current=0;
    autoZoomTimerRef.current=setInterval(()=>{
      if(detectedRef.current||savingRef.current)return;
      zoomIndexRef.current++;
      if(caps&&hardwareSteps.length>1){
        const idx=zoomIndexRef.current%hardwareSteps.length;
        void applyZoom(hardwareSteps[idx]);
      }else{
        digitalCropRef.current=digitalSteps[zoomIndexRef.current%digitalSteps.length];
        setZoomLevel(Number((1/digitalCropRef.current).toFixed(1)));
      }
    },1250);
  }

  async function decodeZxing(canvas:HTMLCanvasElement) {
    try{
      const reader=zxingRef.current;
      if(!reader)return "";
      const result=reader.decodeFromCanvasElement(canvas);
      return String(result?.getText?.() || result?.text || "").trim();
    }catch{return "";}
  }

  async function decodeNimiq(canvas:HTMLCanvasElement){
    try{
      const Qr=nimiqRef.current;
      if(!Qr)return "";
      const result=await Qr.scanImage(canvas,{
        qrEngine:nimiqEngineRef.current||undefined,
        returnDetailedScanResult:true,
      });
      return String(result?.data||result||"").trim();
    }catch{return "";}
  }

  async function multiDecode(source:CanvasImageSource,w:number,h:number,photo=false) {
    const adaptiveCrop=photo?1:digitalCropRef.current;
    const rawConfigs=photo
      ? [{max:3000,crop:1,sharp:false},{max:2600,crop:.90,sharp:true},{max:2200,crop:.76,sharp:true},{max:1800,crop:.62,sharp:true}]
      : [{max:1800,crop:adaptiveCrop,sharp:false},{max:1600,crop:Math.min(.84,adaptiveCrop),sharp:true},{max:1450,crop:Math.min(.68,adaptiveCrop),sharp:true},{max:1200,crop:Math.min(.54,adaptiveCrop),sharp:true}];
    const seen=new Set<string>();
    const configs=rawConfigs.filter(c=>{const k=`${c.max}:${c.crop}`;if(seen.has(k))return false;seen.add(k);return true;});
    for(let i=0;i<configs.length;i++){
      const cfg=configs[i];
      const c=makeCanvas(source,w,h,cfg.max,cfg.crop,cfg.sharp);
      if(!c)continue;

      // Nimiq runs in a Worker and has a noticeably stronger fallback detector on difficult QR codes.
      if(i<2 || photo){
        const nq=await decodeNimiq(c);
        if(nq)return {value:nq,engine:"QR Scanner Worker"};
      }
      const zx=await decodeZxing(c);
      if(zx)return {value:zx,engine:"ZXing TRY-HARDER"};
      const js=jsQrDecode(c);
      if(js)return {value:js,engine:"jsQR multi-pass"};
    }
    return {value:"",engine:""};
  }

  useEffect(()=>{
    let active = true;
    processingRef.current = false;
    detectedRef.current="";
    digitalCropRef.current=1;
    setDetected("");
    setMessage("Pokrećem kameru…");
    setZoomLevel(1);

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
          zoomCapsRef.current=caps.zoom&&Number.isFinite(caps.zoom.min)&&Number.isFinite(caps.zoom.max)
            ? {min:Number(caps.zoom.min),max:Number(caps.zoom.max),step:Number(caps.zoom.step||.1)} : null;
          setZoomAvailable(Boolean(zoomCapsRef.current));
          const advanced:any[] = [];
          if (caps.focusMode?.includes?.("continuous")) advanced.push({focusMode:"continuous"});
          if (caps.exposureMode?.includes?.("continuous")) advanced.push({exposureMode:"continuous"});
          if (caps.whiteBalanceMode?.includes?.("continuous")) advanced.push({whiteBalanceMode:"continuous"});
          if (advanced.length) await track.applyConstraints({advanced} as any);
          if(zoomCapsRef.current)await applyZoom(clamp(1,zoomCapsRef.current.min,zoomCapsRef.current.max));
        } catch {}

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        try {
          if (window.BarcodeDetector) detectorRef.current = new window.BarcodeDetector({formats:["qr_code"]});
        } catch { detectorRef.current = null; }

        // Stronger independent decoders are loaded lazily so camera preview appears immediately.
        import("@zxing/browser").then(async(mod:any)=>{
          try{
            const core=await import("@zxing/library").catch(()=>null as any);
            let hints:any=undefined;
            if(core){
              hints=new Map();
              hints.set(core.DecodeHintType.POSSIBLE_FORMATS,[core.BarcodeFormat.QR_CODE]);
              hints.set(core.DecodeHintType.TRY_HARDER,true);
              if(core.DecodeHintType.ALSO_INVERTED!==undefined)hints.set(core.DecodeHintType.ALSO_INVERTED,true);
            }
            zxingRef.current=new mod.BrowserQRCodeReader(hints);
            if(active)setEngine(detectorRef.current?"Native + QR Worker + ZXing":"QR Worker + ZXing");
          }catch{}
        }).catch(()=>{});

        import("qr-scanner").then(async(mod:any)=>{
          try{
            nimiqRef.current=mod.default;
            nimiqEngineRef.current=await mod.default.createQrEngine();
            if(active)setEngine(detectorRef.current?"Native + QR Worker + ZXing":"QR Worker + ZXing");
          }catch{}
        }).catch(()=>{});

        setMessage("Usmerite QR u okvir. Auto-zoom i fokus rade automatski — držite telefon mirno.");
        startAdaptiveAutoZoom();
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
        if (detectorRef.current) {
          const codes = await detectorRef.current.detect(v as any);
          const value = codes.find(c=>c.rawValue)?.rawValue?.trim();
          if (value) { setEngine("Native BarcodeDetector"); await handleDetected(value); return; }
        }

        const decoded=await multiDecode(v,v.videoWidth,v.videoHeight,false);
        if(decoded.value){setEngine(decoded.engine);await handleDetected(decoded.value);return;}
      } catch {
        // Sledeći kadar automatski pokušava ponovo.
      } finally {
        processingRef.current = false;
      }
    }

    function loop(ts=0) {
      if (!active) return;
      if (ts-lastScanRef.current >= 95) {
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
    return ()=>{
      active=false;
      stopCamera();
      try{nimiqEngineRef.current?.terminate?.();}catch{}
      nimiqEngineRef.current=null;
    };
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
    setMessage("Analiziram fotografiju kroz četiri QR čitača i više nivoa uvećanja…");
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
      <video ref={videoRef} muted playsInline style={!zoomAvailable&&zoomLevel>1?{transform:`scale(${zoomLevel})`,transformOrigin:"center center"}:undefined} />
      <div className="qr-frame" aria-hidden="true"><span/><span/><span/><span/></div>
      <div className="camera-msg">{message}</div>
      <div className="qr-engine"><ScanLine size={13}/> {engine}</div>
      <div className="qr-autozoom"><ZoomIn size={13}/> Auto-zoom {zoomLevel.toFixed(1)}×</div>
      {torchAvailable && <button type="button" className="qr-torch" onClick={toggleTorch} aria-label="Blic"><Flashlight size={18}/></button>}
    </div>

    {zoomAvailable && !detected && <div className="qr-zoom-control">
      <span>Ručno uvećanje</span>
      <input type="range" min={zoomCapsRef.current?.min||1} max={zoomCapsRef.current?.max||1} step={zoomCapsRef.current?.step||.1} value={zoomLevel} onChange={e=>void applyZoom(Number(e.target.value))}/>
      <b>{zoomLevel.toFixed(1)}×</b>
    </div>}

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

    <div className="scanner-info"><ScanLine size={16}/><span>QR 2.0 koristi nativni čitač, QR Worker, ZXing TRY-HARDER i jsQR multi-pass. Ako kamera podržava zoom, FiscalBox ga automatski menja dok ne pronađe kod; na ostalim uređajima koristi digitalni auto-zoom.</span></div>

    <div className="field"><label>Ručni unos fiskalnog QR linka</label><input className="input mono" value={manual} onChange={e=>setManual(e.target.value)} placeholder="https://suf.purs.gov.rs/..." /></div>
    <button className="btn btn-primary" style={{width:"100%",marginTop:10}} disabled={!manual||saving} onClick={()=>save(manual)}>Proveri i sačuvaj fiskalni račun</button>
  </>;
}
