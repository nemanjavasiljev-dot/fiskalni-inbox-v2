"use client";

import React from "react";
import { Camera, Check, Crop, RefreshCw, ScanLine, X } from "lucide-react";

type Point={x:number;y:number};
type Quad={tl:Point;tr:Point;br:Point;bl:Point;area:number};

function defaultScanName() {
  const d = new Date();
  const date = new Intl.DateTimeFormat("sr-RS", { day:"2-digit", month:"2-digit", year:"numeric" }).format(d).replace(/\./g,"-").replace(/-$/," ").trim();
  const time = `${String(d.getHours()).padStart(2,"0")}-${String(d.getMinutes()).padStart(2,"0")}`;
  return `Skenirani dokument ${date} ${time}`;
}

function cleanDisplayName(value:string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g,"-").replace(/\s+/g," ").slice(0,100) || "Skenirani dokument";
}

function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v));}
function distance(a:Point,b:Point){return Math.hypot(a.x-b.x,a.y-b.y);}
function polygonArea(points:Point[]){
  let s=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    s+=a.x*b.y-b.x*a.y;
  }
  return Math.abs(s)/2;
}

function detectDocumentQuad(source:CanvasImageSource,sourceWidth:number,sourceHeight:number):Quad|null{
  if(!sourceWidth||!sourceHeight)return null;
  const max=420;
  const scale=Math.min(1,max/Math.max(sourceWidth,sourceHeight));
  const w=Math.max(80,Math.round(sourceWidth*scale));
  const h=Math.max(80,Math.round(sourceHeight*scale));
  const c=document.createElement("canvas");c.width=w;c.height=h;
  const ctx=c.getContext("2d",{willReadFrequently:true});
  if(!ctx)return null;
  ctx.drawImage(source,0,0,w,h);
  const img=ctx.getImageData(0,0,w,h);
  const data=img.data;
  const lum=new Uint8Array(w*h);
  for(let i=0,p=0;i<data.length;i+=4,p++)lum[p]=Math.round(.299*data[i]+.587*data[i+1]+.114*data[i+2]);

  const patch=Math.max(8,Math.round(Math.min(w,h)*.055));
  let br=0,bg=0,bb=0,n=0;
  const corners=[[0,0],[w-patch,0],[0,h-patch],[w-patch,h-patch]];
  for(const [sx,sy] of corners){
    for(let y=sy;y<sy+patch;y+=2){
      for(let x=sx;x<sx+patch;x+=2){
        const i=(y*w+x)*4;br+=data[i];bg+=data[i+1];bb+=data[i+2];n++;
      }
    }
  }
  br/=n;bg/=n;bb/=n;

  let mask=new Uint8Array(w*h);
  for(let y=2;y<h-2;y++){
    for(let x=2;x<w-2;x++){
      const p=y*w+x,i=p*4;
      const dr=data[i]-br,dg=data[i+1]-bg,db=data[i+2]-bb;
      const color=Math.sqrt(dr*dr+dg*dg+db*db);
      const gx=Math.abs(lum[p+1]-lum[p-1]);
      const gy=Math.abs(lum[p+w]-lum[p-w]);
      const edge=gx+gy;
      // Fill paper when its tone differs from the background; keep strong border/text edges as backup.
      if(color>34 || edge>64)mask[p]=1;
    }
  }

  // Small dilation joins the paper border and printed content into one stable component.
  for(let pass=0;pass<2;pass++){
    const next=mask.slice();
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const p=y*w+x;if(mask[p])continue;
      if(mask[p-1]||mask[p+1]||mask[p-w]||mask[p+w])next[p]=1;
    }
    mask=next;
  }

  const seen=new Uint8Array(w*h);
  const queue=new Int32Array(w*h);
  let best:any=null;
  for(let sy=1;sy<h-1;sy+=2){
    for(let sx=1;sx<w-1;sx+=2){
      const start=sy*w+sx;
      if(!mask[start]||seen[start])continue;
      let head=0,tail=0;queue[tail++]=start;seen[start]=1;
      let count=0,minX=w,maxX=0,minY=h,maxY=0;
      let minSum=1e9,maxSum=-1,minDiff=1e9,maxDiff=-1;
      let tl={x:sx,y:sy},tr={x:sx,y:sy},brp={x:sx,y:sy},bl={x:sx,y:sy};
      while(head<tail){
        const p=queue[head++],y=Math.floor(p/w),x=p-y*w;count++;
        if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
        const sum=x+y,diff=x-y;
        if(sum<minSum){minSum=sum;tl={x,y};}
        if(sum>maxSum){maxSum=sum;brp={x,y};}
        if(diff>maxDiff){maxDiff=diff;tr={x,y};}
        if(diff<minDiff){minDiff=diff;bl={x,y};}
        const neigh=[p-1,p+1,p-w,p+w];
        for(const q of neigh){if(q>0&&q<w*h&&mask[q]&&!seen[q]){seen[q]=1;queue[tail++]=q;}}
      }
      const bw=maxX-minX,bh=maxY-minY;
      const bboxArea=(bw*bh)/(w*h);
      if(count<Math.max(120,w*h*.012)||bboxArea<.12)continue;
      const touches=(minX<3?1:0)+(minY<3?1:0)+(maxX>w-4?1:0)+(maxY>h-4?1:0);
      const centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;
      const centrality=1-Math.min(1,Math.hypot(centerX-w/2,centerY-h/2)/Math.hypot(w/2,h/2));
      const score=count*(1+.25*centrality)*(touches>=3?.55:1);
      if(!best||score>best.score)best={score,tl,tr,br:brp,bl,bboxArea};
    }
  }
  if(!best)return null;
  const pts=[best.tl,best.tr,best.br,best.bl] as Point[];
  const area=polygonArea(pts)/(w*h);
  if(area<.18||area>.985)return null;
  const top=distance(pts[0],pts[1]),bottom=distance(pts[3],pts[2]);
  const left=distance(pts[0],pts[3]),right=distance(pts[1],pts[2]);
  if(Math.min(top,bottom,left,right)<Math.min(w,h)*.12)return null;

  const rx=sourceWidth/w,ry=sourceHeight/h;
  const expand=(p:Point,dx:number,dy:number)=>({x:clamp((p.x+dx)*rx,0,sourceWidth-1),y:clamp((p.y+dy)*ry,0,sourceHeight-1)});
  // Tiny outward margin avoids cutting printed edges.
  const m=Math.max(1,Math.min(w,h)*.008);
  return {
    tl:expand(best.tl,-m,-m),tr:expand(best.tr,m,-m),br:expand(best.br,m,m),bl:expand(best.bl,-m,m),area
  };
}

function solve8(A:number[][],b:number[]){
  const n=8;
  const m=A.map((row,i)=>[...row,b[i]]);
  for(let col=0;col<n;col++){
    let pivot=col;
    for(let r=col+1;r<n;r++)if(Math.abs(m[r][col])>Math.abs(m[pivot][col]))pivot=r;
    if(Math.abs(m[pivot][col])<1e-9)return null;
    [m[col],m[pivot]]=[m[pivot],m[col]];
    const d=m[col][col];for(let j=col;j<=n;j++)m[col][j]/=d;
    for(let r=0;r<n;r++)if(r!==col){const f=m[r][col];if(!f)continue;for(let j=col;j<=n;j++)m[r][j]-=f*m[col][j];}
  }
  return m.map(row=>row[n]);
}

function homographyDestToSource(w:number,h:number,q:Quad){
  const dst=[{x:0,y:0},{x:w-1,y:0},{x:w-1,y:h-1},{x:0,y:h-1}];
  const src=[q.tl,q.tr,q.br,q.bl];
  const A:number[][]=[],b:number[]=[];
  for(let i=0;i<4;i++){
    const x=dst[i].x,y=dst[i].y,u=src[i].x,v=src[i].y;
    A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);
    A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v);
  }
  return solve8(A,b);
}

function perspectiveWarp(source:HTMLCanvasElement,q:Quad){
  const top=distance(q.tl,q.tr),bottom=distance(q.bl,q.br);
  const left=distance(q.tl,q.bl),right=distance(q.tr,q.br);
  let outW=Math.max(1,Math.round(Math.max(top,bottom)));
  let outH=Math.max(1,Math.round(Math.max(left,right)));
  const maxSide=1800;
  const scale=Math.min(1,maxSide/Math.max(outW,outH));
  outW=Math.max(420,Math.round(outW*scale));outH=Math.max(560,Math.round(outH*scale));
  const H=homographyDestToSource(outW,outH,q);
  if(!H)return null;
  const srcCtx=source.getContext("2d",{willReadFrequently:true});
  if(!srcCtx)return null;
  const src=srcCtx.getImageData(0,0,source.width,source.height);
  const out=document.createElement("canvas");out.width=outW;out.height=outH;
  const outCtx=out.getContext("2d",{willReadFrequently:true});if(!outCtx)return null;
  const result=outCtx.createImageData(outW,outH),sd=src.data,dd=result.data,sw=source.width,sh=source.height;
  const [a,b,c,d,e,f,g,hh]=H;
  for(let y=0;y<outH;y++){
    for(let x=0;x<outW;x++){
      const den=g*x+hh*y+1;
      const sx=(a*x+b*y+c)/den,sy=(d*x+e*y+f)/den;
      const di=(y*outW+x)*4;
      if(sx<0||sy<0||sx>=sw-1||sy>=sh-1){dd[di]=dd[di+1]=dd[di+2]=255;dd[di+3]=255;continue;}
      const x0=Math.floor(sx),y0=Math.floor(sy),fx=sx-x0,fy=sy-y0;
      const i00=(y0*sw+x0)*4,i10=i00+4,i01=i00+sw*4,i11=i01+4;
      for(let k=0;k<3;k++){
        const v0=sd[i00+k]*(1-fx)+sd[i10+k]*fx;
        const v1=sd[i01+k]*(1-fx)+sd[i11+k]*fx;
        dd[di+k]=v0*(1-fy)+v1*fy;
      }
      dd[di+3]=255;
    }
  }
  outCtx.putImageData(result,0,0);
  return out;
}

function enhanceScan(canvas:HTMLCanvasElement){
  const ctx=canvas.getContext("2d",{willReadFrequently:true});if(!ctx)return canvas;
  const img=ctx.getImageData(0,0,canvas.width,canvas.height),d=img.data;
  const hist=new Uint32Array(256);let samples=0;
  for(let i=0;i<d.length;i+=32){const y=Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2]);hist[y]++;samples++;}
  let low=0,high=255,acc=0;
  const lowTarget=samples*.015,highTarget=samples*.985;
  for(let i=0;i<256;i++){acc+=hist[i];if(acc>=lowTarget){low=i;break;}}
  acc=0;for(let i=0;i<256;i++){acc+=hist[i];if(acc>=highTarget){high=i;break;}}
  if(high-low<65){low=Math.max(0,low-30);high=Math.min(255,high+30);}
  const range=Math.max(1,high-low);
  for(let i=0;i<d.length;i+=4){
    let r=clamp((d[i]-low)*255/range,0,255),gg=clamp((d[i+1]-low)*255/range,0,255),bb=clamp((d[i+2]-low)*255/range,0,255);
    const y=.299*r+.587*gg+.114*bb;
    const mix=.15;
    r=r*(1-mix)+y*mix;gg=gg*(1-mix)+y*mix;bb=bb*(1-mix)+y*mix;
    if(y>225){r=Math.max(r,244);gg=Math.max(gg,244);bb=Math.max(bb,244);}
    if(y<85){r*=.88;gg*=.88;bb*=.88;}
    d[i]=clamp(r,0,255);d[i+1]=clamp(gg,0,255);d[i+2]=clamp(bb,0,255);
  }
  ctx.putImageData(img,0,0);return canvas;
}

async function canvasBlob(canvas:HTMLCanvasElement) {
  return await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",0.94));
}

function normalizedQuad(q:Quad,w:number,h:number):Quad{
  const norm=(p:Point)=>({x:p.x/w,y:p.y/h});
  return {tl:norm(q.tl),tr:norm(q.tr),br:norm(q.br),bl:norm(q.bl),area:q.area};
}
function denormalizedQuad(q:Quad,w:number,h:number):Quad{
  const den=(p:Point)=>({x:p.x*w,y:p.y*h});
  return {tl:den(q.tl),tr:den(q.tr),br:den(q.br),bl:den(q.bl),area:q.area};
}
function quadDifference(a:Quad,b:Quad){
  return (["tl","tr","br","bl"] as const).reduce((s,k)=>s+distance(a[k],b[k]),0)/4;
}

export default function DocumentScanner({ onCapture, onClose }: { onCapture: (file: File) => void | Promise<void>; onClose: () => void }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const analysisTimerRef=React.useRef<ReturnType<typeof setInterval>|null>(null);
  const lastQuadRef=React.useRef<Quad|null>(null);
  const stableRef=React.useRef(0);
  const capturingRef=React.useRef(false);
  const [preview, setPreview] = React.useState<string>("");
  const [capturedBlob,setCapturedBlob] = React.useState<Blob|null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [documentName,setDocumentName] = React.useState(defaultScanName());
  const [cropMessage,setCropMessage] = React.useState("");
  const [guideQuad,setGuideQuad]=React.useState<Quad|null>(null);
  const [scanStatus,setScanStatus]=React.useState("Tražim ivice dokumenta…");

  const stopAnalysis=React.useCallback(()=>{if(analysisTimerRef.current)clearInterval(analysisTimerRef.current);analysisTimerRef.current=null;},[]);
  const stopCamera=React.useCallback(()=>{
    stopAnalysis();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current=null;
  },[stopAnalysis]);

  const capture=React.useCallback(async(qNorm?:Quad|null)=>{
    const video=videoRef.current,canvas=canvasRef.current;
    if(!video||!canvas||!video.videoWidth||capturingRef.current)return;
    capturingRef.current=true;setBusy(true);setError("");setScanStatus("Obrađujem sken…");setCropMessage("Ispravljam perspektivu i čistim dokument…");
    try{
      const max=2400,scale=Math.min(1,max/Math.max(video.videoWidth,video.videoHeight));
      canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
      const ctx=canvas.getContext("2d",{willReadFrequently:true});if(!ctx)throw new Error("Sken nije kreiran.");
      ctx.drawImage(video,0,0,canvas.width,canvas.height);
      let q=qNorm?denormalizedQuad(qNorm,canvas.width,canvas.height):detectDocumentQuad(canvas,canvas.width,canvas.height);
      let output:HTMLCanvasElement|null=null;
      if(q){output=perspectiveWarp(canvas,q);}
      if(!output){
        // Safe fallback: still create a scanner-style enhanced page instead of a raw camera photo.
        output=document.createElement("canvas");
        const ratio=.92,sx=canvas.width*(1-ratio)/2,sy=canvas.height*(1-ratio)/2;
        output.width=Math.round(canvas.width*ratio);output.height=Math.round(canvas.height*ratio);
        output.getContext("2d")?.drawImage(canvas,sx,sy,output.width,output.height,0,0,output.width,output.height);
        setCropMessage("Ivica nije bila potpuno sigurna. Primeniо sam skenersku obradu i centralni krop — proverite rezultat.");
      }else{
        setCropMessage("Dokument je automatski isečen, ispravljena je perspektiva i primenjena skenerska obrada.");
      }
      enhanceScan(output);
      const blob=await canvasBlob(output);if(!blob)throw new Error("Sken nije kreiran.");
      setCapturedBlob(blob);
      if(preview)URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(blob));
      setGuideQuad(null);stopCamera();setScanStatus("Sken je spreman.");
    }catch(e:any){setError(e?.message||"Skeniranje nije uspelo.");setCropMessage("");setScanStatus("Pokušajte ponovo.");}
    finally{capturingRef.current=false;setBusy(false);}
  },[preview,stopCamera]);

  const startLiveDetection=React.useCallback(()=>{
    stopAnalysis();
    analysisTimerRef.current=setInterval(()=>{
      const video=videoRef.current;
      if(!video||video.readyState<2||!video.videoWidth||capturingRef.current)return;
      const found=detectDocumentQuad(video,video.videoWidth,video.videoHeight);
      if(!found){stableRef.current=0;lastQuadRef.current=null;setGuideQuad(null);setScanStatus("Tražim ivice dokumenta…");return;}
      const q=normalizedQuad(found,video.videoWidth,video.videoHeight);
      setGuideQuad(q);
      const previous=lastQuadRef.current;
      if(previous&&quadDifference(previous,q)<.018)stableRef.current++;else stableRef.current=1;
      lastQuadRef.current=q;
      if(stableRef.current>=4&&q.area>.24){
        setScanStatus("Dokument je miran — automatski skeniram…");
        stableRef.current=0;
        void capture(q);
      }else setScanStatus(stableRef.current>=2?"Dokument pronađen — držite mirno…":"Poravnajte dokument unutar kadra…");
    },320);
  },[capture,stopAnalysis]);

  const startCamera=React.useCallback(async()=>{
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 3840,min:1280 }, height: { ideal: 2160,min:720 },frameRate:{ideal:30} },
        audio: false
      });
      streamRef.current = stream;
      const track=stream.getVideoTracks()[0];
      try {
        const caps:any=track.getCapabilities?.()||{};
        const advanced:any[]=[];
        if(caps.focusMode?.includes?.("continuous"))advanced.push({focusMode:"continuous"});
        if(caps.exposureMode?.includes?.("continuous"))advanced.push({exposureMode:"continuous"});
        if(advanced.length)await track.applyConstraints({advanced} as any);
      } catch {}
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        startLiveDetection();
      }
    } catch {
      setError("Kamera nije dostupna. Dozvolite pristup kameri ili koristite Fotografisi / Dodaj fajl.");
    }
  },[startLiveDetection]);

  React.useEffect(() => {
    void startCamera();
    return () => {
      stopCamera();
      if (preview) URL.revokeObjectURL(preview);
    };
  // preview namerno nije dependency da cleanup ne gasi kameru pri svakom pregledu
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startCamera,stopCamera]);

  async function save() {
    if (!capturedBlob) return;
    const name=cleanDisplayName(documentName);
    if(!name){setError("Upišite naziv dokumenta.");return;}
    setBusy(true);
    try { await onCapture(new File([capturedBlob], `${name}.jpg`, { type: "image/jpeg" })); }
    finally { setBusy(false); }
  }

  async function retry() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");setCapturedBlob(null);setError("");setCropMessage("");setGuideQuad(null);setScanStatus("Tražim ivice dokumenta…");
    lastQuadRef.current=null;stableRef.current=0;capturingRef.current=false;
    await startCamera();
  }

  const polygon=guideQuad ? `${guideQuad.tl.x*100},${guideQuad.tl.y*100} ${guideQuad.tr.x*100},${guideQuad.tr.y*100} ${guideQuad.br.x*100},${guideQuad.br.y*100} ${guideQuad.bl.x*100},${guideQuad.bl.y*100}` : "";

  return <div className="document-scanner">
    <div className="document-scanner-head"><div><span className="pill">AUTOMATSKI SKENER DOKUMENTA</span><h2>Skeniraj dokument</h2></div><button className="btn" onClick={onClose}><X size={16}/> Zatvori</button></div>
    <div className="document-camera-stage">
      {!preview ? <video ref={videoRef} muted playsInline /> : <img src={preview} alt="Pregled skeniranog dokumenta" />}
      <canvas ref={canvasRef} hidden />
      {!preview && <>
        <div className="document-camera-guide"><span>{scanStatus}</span></div>
        {guideQuad&&<svg className="document-detected-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points={polygon}/></svg>}
        <div className={`document-scan-state ${guideQuad?"ready":""}`}><ScanLine size={15}/>{guideQuad?"Dokument pronađen":"Detekcija ivica"}</div>
      </>}
    </div>
    {cropMessage && <div className="scanner-info"><Crop size={16}/><span>{cropMessage}</span></div>}
    {error && <div className="error">{error}</div>}
    {preview && <div className="field document-name-field"><label>Naziv dokumenta *</label><input className="input" value={documentName} onChange={e=>setDocumentName(e.target.value)} autoFocus maxLength={100} placeholder="npr. Račun za gorivo septembar"/><small>Naziv možete promeniti pre čuvanja.</small></div>}
    <div className="document-scanner-actions">
      {!preview ? <button className="btn btn-primary" onClick={()=>capture(guideQuad)} disabled={!!error||busy}><Camera size={17}/> {busy?"Skeniram…":"Skeniraj odmah"}</button> : <>
        <button className="btn" onClick={retry} disabled={busy}><RefreshCw size={16}/> Ponovi sken</button>
        <button className="btn btn-primary" onClick={save} disabled={busy||!documentName.trim()}><Check size={17}/> {busy ? "Čuvam…" : "Sačuvaj sken"}</button>
      </>}
    </div>
  </div>;
}
