import type {Metadata,Viewport} from 'next';
import {getPlatformBrand} from '@/lib/server/branding';
import {brandIconPath,browserBrandIcon} from '@/lib/brand-icons';
import {CookiePreferences} from '@/components/cookie-preferences';
import {WorkspaceLoadingBrandProvider} from '@/components/workspace-loading-brand';
import './globals.css';
// Branding renders from production settings; /favicon.svg is only a legacy direct-URL fallback.
// Public content can be cached; private pages still become dynamic when they read cookies.
export const revalidate=60;
export async function generateViewport():Promise<Viewport>{const b=await getPlatformBrand();return {width:'device-width',initialScale:1,themeColor:b.primary_color};}
export async function generateMetadata():Promise<Metadata>{const b=await getPlatformBrand();return {title:`${b.name} — ${b.tagline}`,description:b.description,manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:b.short_name||b.name,statusBarStyle:'default'},icons:{icon:[{url:browserBrandIcon(b)}],shortcut:browserBrandIcon(b),apple:[{url:brandIconPath(b,180),sizes:'180x180',type:'image/png'}]}};}
export default async function RootLayout({children}:{children:React.ReactNode}){
 const b=await getPlatformBrand();
 return <html lang="en"><body style={{'--brand':b.primary_color,'--green':b.accent_color} as React.CSSProperties}><WorkspaceLoadingBrandProvider branding={{platformName:b.name,logoUrl:b.logo_url}}>{children}</WorkspaceLoadingBrandProvider><CookiePreferences/></body></html>;
}
