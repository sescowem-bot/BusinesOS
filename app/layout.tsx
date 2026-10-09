import type {Metadata} from 'next';
import {getPlatformBrand} from '@/lib/server/branding';
import './globals.css';
export const dynamic='force-dynamic';
export async function generateMetadata():Promise<Metadata>{const b=await getPlatformBrand();return {title:`${b.name} — ${b.tagline}`,description:b.description,icons:b.favicon_url?{icon:b.favicon_url}:undefined};}
export default async function RootLayout({children}:{children:React.ReactNode}){
 const b=await getPlatformBrand();
 return <html lang="en"><body style={{'--brand':b.primary_color,'--green':b.accent_color} as React.CSSProperties}>{children}</body></html>;
}
