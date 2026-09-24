const CACHE='fiscalbox-public-v7';
const PUBLIC_SHELL=['/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png'];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(PUBLIC_SHELL)).catch(()=>{}));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('fiscalbox-public-')&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  const cacheable=PUBLIC_SHELL.includes(url.pathname)||url.pathname.startsWith('/_next/static/')||url.pathname.startsWith('/icons/');
  if(!cacheable)return;
  event.respondWith(
    fetch(event.request)
      .then(response=>{
        if(response.ok&&!response.redirected&&!/private|no-store/i.test(response.headers.get('cache-control')||'')){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{})}
        return response;
      })
      .catch(()=>caches.match(event.request).then(r=>r||Response.error()))
  );
});

self.addEventListener('push',event=>{
  let data={title:'FiscalBox',body:'Imate novo obaveštenje.',url:'/app',tag:'fiscalbox'};
  try{data={...data,...event.data.json()}}catch{}
  const options={
    body:data.body,
    icon:'/icons/icon-192.png',
    badge:'/icons/icon-192.png',
    tag:data.tag||'fiscalbox',
    renotify:true,
    requireInteraction:false,
    timestamp:Date.now(),
    data:{url:data.url||'/app',eventKey:data.eventKey||''}
  };
  event.waitUntil((async()=>{
    const openClients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of openClients){
      try{client.postMessage({type:'fiscalbox:push',payload:data});}catch{}
    }
    await self.registration.showNotification(data.title,options);
  })());
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  let url='/app';
  try{const target=new URL(event.notification.data?.url||'/app',self.location.origin);if(target.origin===self.location.origin)url=target.href;}catch{}
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const client of list){if('focus' in client){client.navigate(url);return client.focus();}}
    return clients.openWindow(url);
  }));
});
