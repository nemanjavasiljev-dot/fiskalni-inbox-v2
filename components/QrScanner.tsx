"use client";

import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";

export default function QrScanner({ organizationId, onDone }:{
  organizationId:string; onDone:()=>void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const rafRef = useRef<number|undefined>(undefined);
  const [message,setMessage] = useState("Pokrećem kameru…");
  const [manual,setManual] = useState("");
  const [saving,setSaving] = useState(false);

  useEffect(()=>{
    let active = true;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video:{ facingMode:{ideal:"environment"}, width:{ideal:1920}, height:{ideal:1080} },
          audio:false
        });
        if (!active) return;
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setMessage("Držite ceo QR kod u kadru.");
        loop();
      } catch {
        setMessage("Kamera nije dostupna. Dozvolite pristup ili nalepite QR link.");
      }
    }
    function loop() {
      const v = videoRef.current, c = canvasRef.current;
      if (!v || !c || !active) return;
      if (v.readyState >= 2 && v.videoWidth > 0) {
        const max = 1280;
        const scale = Math.min(1,max/v.videoWidth);
        c.width = Math.round(v.videoWidth*scale);
        c.height = Math.round(v.videoHeight*scale);
        const ctx = c.getContext("2d",{willReadFrequently:true});
        if (ctx) {
          ctx.drawImage(v,0,0,c.width,c.height);
          const image = ctx.getImageData(0,0,c.width,c.height);
          const code = jsQR(image.data,c.width,c.height,{inversionAttempts:"attemptBoth"});
          if (code?.data) { save(code.data); return; }
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    start();
    return ()=>{
      active=false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t=>t.stop());
    };
  },[]);

  async function save(qr:string) {
    if (saving) return;
    setSaving(true); setMessage("Proveravam i čuvam račun…");
    streamRef.current?.getTracks().forEach(t=>t.stop());
    try {
      const r = await fetch("/api/receipts/scan",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({organization_id:organizationId,qr_url:qr})
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Greška.");
      setMessage(d.duplicate ? "Račun je već u bazi." : "Račun je sačuvan.");
      setTimeout(onDone,600);
    } catch(e:any) {
      setMessage(e.message || "Skeniranje nije uspelo.");
      setSaving(false);
    }
  }

  return <>
    <div className="camera-box">
      <video ref={videoRef} muted playsInline />
      <canvas ref={canvasRef} style={{display:"none"}}/>
      <div className="camera-msg">{message}</div>
    </div>
    <div className="field"><label>Ručni QR link</label><input className="input mono" value={manual} onChange={e=>setManual(e.target.value)} placeholder="https://..." /></div>
    <button className="btn btn-primary" style={{width:"100%",marginTop:10}} disabled={!manual||saving} onClick={()=>save(manual)}>Sačuvaj link</button>
  </>;
}
