const CACHE='fiscalbox-public-v2';
const PUBLIC_SHELL=['/','/login','/register','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(c=>c.addAll(PUBLIC_SHELL)).catch(()=>{}))});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;
  const cacheable=PUBLIC_SHELL.includes(url.pathname)||url.pathname.startsWith('/_next/static/')||url.pathname.startsWith('/icons/');
  if(!cacheable)return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{})}return response}).catch(()=>caches.match(event.request).then(r=>r||Response.error())));
});
self.addEventListener('push',event=>{
  let data={title:'FiscalBox',body:'Imate novu poruku.',url:'/app'};
  try{data={...data,...event.data.json()}}catch{}
  event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',data:{url:data.url||'/app'}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();const url=event.notification.data?.url||'/app';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if('focus' in client){client.navigate(url);return client.focus();}}return clients.openWindow(url);}));
});
