import type {MetadataRoute} from 'next';
export default function manifest():MetadataRoute.Manifest{
 return {id:'/',name:'Treviko — Your personal coach',short_name:'Treviko',description:'Purposeful training, with optional nutrition coaching, built around your life.',start_url:'/',scope:'/',display:'standalone',background_color:'#f5f7f3',theme_color:'#143e30',lang:'en',icons:[{src:'/icons/treviko-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icons/treviko-512.png',sizes:'512x512',type:'image/png',purpose:'any'},{src:'/icons/treviko-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]};
}
