import type {MetadataRoute} from 'next';
import {getPlatformBrand} from '@/lib/server/branding';
import {brandIconPath} from '@/lib/brand-icons';
// Manifest is public, low-cost, and only changes when the platform brand changes.
export const revalidate=300;
export default async function manifest():Promise<MetadataRoute.Manifest>{
 const b=await getPlatformBrand();
 return {
  id:'/',name:b.name,short_name:b.short_name||b.name,
  description:b.description,start_url:'/dashboard',scope:'/',display:'standalone',
  background_color:'#f4f7fb',theme_color:b.primary_color,
  icons:[
   {src:brandIconPath(b,192),sizes:'192x192',type:'image/png',purpose:'any'},
   {src:brandIconPath(b,512),sizes:'512x512',type:'image/png',purpose:'any'},
   {src:brandIconPath(b,512,true),sizes:'512x512',type:'image/png',purpose:'maskable'}
  ]
 };
}
