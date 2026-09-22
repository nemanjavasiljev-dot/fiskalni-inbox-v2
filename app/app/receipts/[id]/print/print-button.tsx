"use client";
import { useEffect } from "react";

export default function PrintButton({autoPrint=false}:{autoPrint?:boolean}){
  useEffect(()=>{if(autoPrint){const t=setTimeout(()=>window.print(),350);return()=>clearTimeout(t)}},[autoPrint]);
  return <div className="no-print" style={{textAlign:"right",marginBottom:20}}><button className="btn btn-primary" onClick={()=>window.print()}>Štampaj / Sačuvaj kao PDF</button><style jsx global>{`@media print{.no-print{display:none!important}body{background:white}}`}</style></div>
}
