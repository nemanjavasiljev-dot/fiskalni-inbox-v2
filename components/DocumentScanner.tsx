"use client";

import React from "react";
import { Camera, Check, Crop, RefreshCw, X } from "lucide-react";

function defaultScanName() {
  const d = new Date();
  const date = new Intl.DateTimeFormat("sr-RS", { day:"2-digit", month:"2-digit", year:"numeric" }).format(d).replace(/\./g,"-").replace(/-$/," ").trim();
  const time = `${String(d.getHours()).padStart(2,"0")}-${String(d.getMinutes()).padStart(2,"0")}`;
  return `Skenirani dokument ${date} ${time}`;
}

function cleanDisplayName(value:string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g,"-").replace(/\s+/g," ").slice(0,100) || "Skenirani dokument";
}

function detectCrop(source: HTMLCanvasElement) {
  const max = 640;
  const scale = Math.min(1, max / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently:true });
  if (!ctx) return null;
  ctx.drawImage(source,0,0,w,h);
  const data = ctx.getImageData(0,0,w,h).data;

  const corner = Math.max(8, Math.round(Math.min(w,h)*0.04));
  const corners = [
    [0,0],[w-corner,0],[0,h-corner],[w-corner,h-corner]
  ];
  let br=0,bg=0,bb=0,n=0;
  for (const [sx,sy] of corners) {
    for (let y=sy;y<sy+corner;y+=2) for (let x=sx;x<sx+corner;x+=2) {
      const i=(y*w+x)*4; br+=data[i]; bg+=data[i+1]; bb+=data[i+2]; n++;
    }
  }
  br/=n; bg/=n; bb/=n;

  const rows = new Uint32Array(h);
  const cols = new Uint32Array(w);
  const step = Math.max(1, Math.round(Math.max(w,h)/500));
  for (let y=1;y<h-1;y+=step) {
    for (let x=1;x<w-1;x+=step) {
      const i=(y*w+x)*4;
      const dr=data[i]-br, dg=data[i+1]-bg, db=data[i+2]-bb;
      const colorDistance=Math.sqrt(dr*dr+dg*dg+db*db);
      const left=(y*w+(x-1))*4, right=(y*w+(x+1))*4, up=((y-1)*w+x)*4, down=((y+1)*w+x)*4;
      const lum=(idx:number)=>data[idx]*0.299+data[idx+1]*0.587+data[idx+2]*0.114;
      const edge=Math.abs(lum(right)-lum(left))+Math.abs(lum(down)-lum(up));
      if (colorDistance>42 || edge>65) { rows[y]++; cols[x]++; }
    }
  }

  const rowThreshold=Math.max(2,Math.round((w/step)*0.025));
  const colThreshold=Math.max(2,Math.round((h/step)*0.025));
  let top=-1,bottom=-1,left=-1,right=-1;
  for (let y=0;y<h;y++) if (rows[y]>=rowThreshold) { top=y; break; }
  for (let y=h-1;y>=0;y--) if (rows[y]>=rowThreshold) { bottom=y; break; }
  for (let x=0;x<w;x++) if (cols[x]>=colThreshold) { left=x; break; }
  for (let x=w-1;x>=0;x--) if (cols[x]>=colThreshold) { right=x; break; }
  if (top<0 || left<0 || bottom<=top || right<=left) return null;

  const bw=right-left, bh=bottom-top;
  const area=(bw*bh)/(w*h);
  if (area<0.22) return null;
  const margin=Math.round(Math.min(w,h)*0.025);
  left=Math.max(0,left-margin); top=Math.max(0,top-margin);
  right=Math.min(w-1,right+margin); bottom=Math.min(h-1,bottom+margin);

  const ratioX=source.width/w, ratioY=source.height/h;
  return {
    x:Math.round(left*ratioX), y:Math.round(top*ratioY),
    width:Math.max(1,Math.round((right-left)*ratioX)),
    height:Math.max(1,Math.round((bottom-top)*ratioY)),
    cropped: area < 0.94
  };
}

async function canvasBlob(canvas:HTMLCanvasElement) {
  return await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",0.92));
}

export default function DocumentScanner({ onCapture, onClose }: { onCapture: (file: File) => void | Promise<void>; onClose: () => void }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [preview, setPreview] = React.useState<string>("");
  const [capturedBlob,setCapturedBlob] = React.useState<Blob|null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [documentName,setDocumentName] = React.useState(defaultScanName());
  const [cropMessage,setCropMessage] = React.useState("");

  const stopCamera=React.useCallback(()=>{
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current=null;
  },[]);

  const startCamera=React.useCallback(async()=>{
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1440 } },
        audio: false
      });
      streamRef.current = stream;
      const track=stream.getVideoTracks()[0];
      try {
        const caps:any=track.getCapabilities?.()||{};
        if(caps.focusMode?.includes?.("continuous")) await track.applyConstraints({advanced:[{focusMode:"continuous"} as any]});
      } catch {}
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setError("Kamera nije dostupna. Dozvolite pristup kameri ili koristite Fotografisi / Dodaj fajl.");
    }
  },[]);

  React.useEffect(() => {
    void startCamera();
    return () => {
      stopCamera();
      if (preview) URL.revokeObjectURL(preview);
    };
  // preview namerno nije dependency da cleanup ne gasi kameru pri svakom pregledu
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startCamera,stopCamera]);

  async function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    setBusy(true); setError(""); setCropMessage("Automatski pronalazim ivice dokumenta…");
    try {
      const max = 2800;
      const scale = Math.min(1, max / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Snimak nije kreiran.");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const crop=detectCrop(canvas);
      let output=canvas;
      if(crop?.cropped) {
        const cropped=document.createElement("canvas");
        cropped.width=crop.width; cropped.height=crop.height;
        const cctx=cropped.getContext("2d");
        if(cctx) {
          cctx.drawImage(canvas,crop.x,crop.y,crop.width,crop.height,0,0,crop.width,crop.height);
          output=cropped;
          setCropMessage("Dokument je automatski kropovan. Proverite pregled i upišite naziv.");
        }
      } else {
        setCropMessage("Dokument je snimljen. Automatski krop nije bio siguran, pa je sačuvan ceo kadar.");
      }

      const blob=await canvasBlob(output);
      if(!blob) throw new Error("Snimak nije kreiran.");
      setCapturedBlob(blob);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(blob));
      stopCamera();
    } catch(e:any) {
      setError(e?.message||"Snimanje nije uspelo.");
      setCropMessage("");
    } finally { setBusy(false); }
  }

  async function save() {
    if (!capturedBlob) return;
    const name=cleanDisplayName(documentName);
    if(!name){setError("Upišite naziv dokumenta.");return;}
    setBusy(true);
    try {
      await onCapture(new File([capturedBlob], `${name}.jpg`, { type: "image/jpeg" }));
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(""); setCapturedBlob(null); setError(""); setCropMessage("");
    await startCamera();
  }

  return <div className="document-scanner">
    <div className="document-scanner-head"><div><span className="pill">SKENER DOKUMENTA</span><h2>Skeniraj dokument</h2></div><button className="btn" onClick={onClose}><X size={16}/> Zatvori</button></div>
    <div className="document-camera-stage">
      {!preview ? <video ref={videoRef} muted playsInline /> : <img src={preview} alt="Pregled skeniranog dokumenta" />}
      <canvas ref={canvasRef} hidden />
      {!preview && <div className="document-camera-guide"><span>Držite ceo dokument u kadru — automatski ćemo ga kropovati</span></div>}
    </div>
    {cropMessage && <div className="scanner-info"><Crop size={16}/><span>{cropMessage}</span></div>}
    {error && <div className="error">{error}</div>}
    {preview && <div className="field document-name-field"><label>Naziv dokumenta *</label><input className="input" value={documentName} onChange={e=>setDocumentName(e.target.value)} autoFocus maxLength={100} placeholder="npr. Račun za gorivo septembar"/><small>Naziv možete promeniti pre čuvanja.</small></div>}
    <div className="document-scanner-actions">
      {!preview ? <button className="btn btn-primary" onClick={capture} disabled={!!error||busy}><Camera size={17}/> {busy?"Obrađujem…":"Snimi dokument"}</button> : <>
        <button className="btn" onClick={retry} disabled={busy}><RefreshCw size={16}/> Ponovi</button>
        <button className="btn btn-primary" onClick={save} disabled={busy||!documentName.trim()}><Check size={17}/> {busy ? "Čuvam…" : "Sačuvaj u Fajlove"}</button>
      </>}
    </div>
  </div>;
}
