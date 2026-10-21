import type {Metadata,Viewport} from 'next';
import {getPlatformBrand} from '@/lib/server/branding';
import {CookiePreferences} from '@/components/cookie-preferences';
import {WorkspaceLoadingBrandProvider} from '@/components/workspace-loading-brand';
import './globals.css';
// Public content can be cached; private pages still become dynamic when they read cookies.
export const revalidate=60;
export async function generateViewport():Promise<Viewport>{const b=await getPlatformBrand();return {width:'device-width',initialScale:1,themeColor:b.primary_color};}
export async function generateMetadata():Promise<Metadata>{const b=await getPlatformBrand();return {title:`${b.name} — ${b.tagline}`,description:b.description,manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:b.short_name||b.name,statusBarStyle:'default'},icons:{icon:b.favicon_url?b.favicon_url:'/favicon.svg',shortcut:b.favicon_url?b.favicon_url:'/favicon.svg',apple:'/app-icon-180.png'}};}
export default async function RootLayout({children}:{children:React.ReactNode}){
 const b=await getPlatformBrand();
 return <html lang="en"><body style={{'--brand':b.primary_color,'--green':b.accent_color} as React.CSSProperties}><WorkspaceLoadingBrandProvider branding={{platformName:b.name,logoUrl:b.logo_url}}>{children}</WorkspaceLoadingBrandProvider><CookiePreferences/></body></html>;
}
