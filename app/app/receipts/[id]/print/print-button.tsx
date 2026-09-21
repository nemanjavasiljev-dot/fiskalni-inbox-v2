"use client";
export default function PrintButton(){return <div className="no-print" style={{textAlign:"right",marginBottom:20}}><button className="btn btn-primary" onClick={()=>window.print()}>Štampaj / Sačuvaj kao PDF</button><style jsx global>{`@media print{.no-print{display:none!important}body{background:white}}`}</style></div>}
