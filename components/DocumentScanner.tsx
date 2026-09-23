"use client";

import React from "react";
import { Camera, Check, RefreshCw, X } from "lucide-react";

export default function DocumentScanner({ onCapture, onClose }: { onCapture: (file: File) => void | Promise<void>; onClose: () => void }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [preview, setPreview] = React.useState<string>("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        if (!active) return;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setError("Kamera nije dostupna. Dozvolite pristup kameri ili koristite Fotografisi / Dodaj fajl.");
      }
    })();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (preview) URL.revokeObjectURL(preview);
    };
  }, []);

  async function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    const max = 1800;
    const scale = Math.min(1, max / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(url);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    try {
      const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("Snimak nije kreiran.");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      await onCapture(new File([blob], `sken-${stamp}.jpg`, { type: "image/jpeg" }));
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
    setError("");
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      } catch { setError("Kamera nije dostupna."); }
    })();
  }

  return <div className="document-scanner">
    <div className="document-scanner-head"><div><span className="pill">SKENER DOKUMENTA</span><h2>Skeniraj dokument</h2></div><button className="btn" onClick={onClose}><X size={16}/> Zatvori</button></div>
    <div className="document-camera-stage">
      {!preview ? <video ref={videoRef} muted playsInline /> : <img src={preview} alt="Pregled skeniranog dokumenta" />}
      <canvas ref={canvasRef} hidden />
      {!preview && <div className="document-camera-guide"><span>Poravnajte dokument unutar okvira</span></div>}
    </div>
    {error && <div className="error">{error}</div>}
    <div className="document-scanner-actions">
      {!preview ? <button className="btn btn-primary" onClick={capture} disabled={!!error}><Camera size={17}/> Snimi dokument</button> : <>
        <button className="btn" onClick={retry}><RefreshCw size={16}/> Ponovi</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}><Check size={17}/> {busy ? "Cuvam..." : "Sacuvaj u Fajlove"}</button>
      </>}
    </div>
  </div>;
}
