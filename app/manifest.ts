import type { MetadataRoute } from 'next';
export default function manifest():MetadataRoute.Manifest{
  return {
    name:'Fiskalni Inbox',short_name:'Fiskalni Inbox',description:'Fiskalni računi i dokumenti između firme i knjigovođe.',
    start_url:'/app',display:'standalone',background_color:'#f4f7f5',theme_color:'#0f6b4f',orientation:'any',
    icons:[{src:'/icons/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icons/icon-512.png',sizes:'512x512',type:'image/png'}]
  };
}
