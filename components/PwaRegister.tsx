"use client";
import React from 'react';
export default function PwaRegister(){
  React.useEffect(()=>{if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}},[]);
  return null;
}
