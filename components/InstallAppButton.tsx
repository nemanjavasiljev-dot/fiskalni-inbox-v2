"use client";
import React from 'react';
import { Download } from 'lucide-react';

type InstallPromptEvent=Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};

export default function InstallAppButton({compact=false}:{compact?:boolean}){
  const [promptEvent,setPromptEvent]=React.useState<InstallPromptEvent|null>(null);
  const [installed,setInstalled]=React.useState(false);
  const [help,setHelp]=React.useState('');
  React.useEffect(()=>{
    setInstalled(window.matchMedia('(display-mode: standalone)').matches);
    const handler=(e:Event)=>{e.preventDefault();setPromptEvent(e as InstallPromptEvent)};
    window.addEventListener('beforeinstallprompt',handler);
    window.addEventListener('appinstalled',()=>setInstalled(true));
    return()=>window.removeEventListener('beforeinstallprompt',handler);
  },[]);
  async function install(){
    if(installed){setHelp('Aplikacija je već instalirana na ovom uređaju.');return;}
    if(promptEvent){await promptEvent.prompt();const choice=await promptEvent.userChoice;if(choice.outcome==='accepted')setInstalled(true);setPromptEvent(null);return;}
    const ua=navigator.userAgent.toLowerCase();
    if(ua.includes('firefox')) setHelp('Firefox za Windows: kliknite Web apps ikonicu u adresnoj liniji i dodajte FiscalBox kao web aplikaciju. Potreban je Firefox 143+ (150+ ako je instaliran iz Microsoft Store-a).');
    else if(ua.includes('edg')) setHelp('Edge: otvorite meni … → Apps → Install this site as an app.');
    else if(ua.includes('safari')&&!ua.includes('chrome')) setHelp('Safari/macOS: koristite File → Add to Dock ili Share → Add to Home Screen, u zavisnosti od verzije.');
    else setHelp('Ako browser ne prikaže automatski Install, otvorite njegov meni i izaberite Install app / Add to Home Screen / Add to Dock.');
  }
  return <div className={`install-app-block ${compact?"compact":""}`}><button className={`btn ${compact?"btn-install-compact":"btn-primary"}`} onClick={install}><Download size={17}/>{installed?'Instalirano':compact?'Instaliraj app':'Instaliraj desktop app'}</button>{help&&<p className="muted install-help">{help}</p>}</div>;
}
