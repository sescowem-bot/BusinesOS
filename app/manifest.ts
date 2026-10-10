import type {MetadataRoute} from 'next';
import {getPlatformBrand} from '@/lib/server/branding';
// Manifest is public, low-cost, and only changes when the platform brand changes.
export const revalidate=300;
export default async function manifest():Promise<MetadataRoute.Manifest>{
 const b=await getPlatformBrand();
 return {
  id:'/',name:b.name,short_name:b.short_name||b.name,
  description:b.description,start_url:'/dashboard',scope:'/',display:'standalone',
  background_color:'#f4f7fb',theme_color:'#123B63',
  icons:[
   {src:'/app-icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},
   {src:'/app-icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},
   {src:'/app-icon-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}
  ]
 };
}
