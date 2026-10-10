import type {Metadata} from 'next';
import {getPlatformBrand} from '@/lib/server/branding';
import './globals.css';
// Public content can be cached; private pages still become dynamic when they read cookies.
export const revalidate=60;
export async function generateMetadata():Promise<Metadata>{const b=await getPlatformBrand();return {title:`${b.name} — ${b.tagline}`,description:b.description,icons:{icon:b.favicon_url?b.favicon_url:'/favicon.svg',shortcut:b.favicon_url?b.favicon_url:'/favicon.svg',apple:b.favicon_url||'/favicon.svg'}};}
export default async function RootLayout({children}:{children:React.ReactNode}){
 const b=await getPlatformBrand();
 return <html lang="en"><body style={{'--brand':b.primary_color,'--green':b.accent_color} as React.CSSProperties}>{children}</body></html>;
}
