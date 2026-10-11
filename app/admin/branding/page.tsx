import Link from 'next/link';
import {Palette,ArrowLeft,ExternalLink} from 'lucide-react';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {getPlatformBrand} from '@/lib/server/branding';
import {whatsappUrl} from '@/lib/public-contact';
import {BrandingForm} from '../branding-form';
import {BrandingAssets} from '../branding-assets';
export const dynamic='force-dynamic';
export default async function PlatformBrandStudio(){
 const session=await requirePlatformAdmin();if(!session)return null;
 const brand=await getPlatformBrand(); const chat=whatsappUrl(brand.support_phone,`Hello ${brand.name}, I'd like to learn more.`);
 return <main className="admin-area owner-brand-studio"><header className="admin-header"><div><span className="owner-eyebrow"><Palette size={16}/> BRAND STUDIO</span><h1>Your brand, your identity</h1><p>Change the platform name, identity, logo and contact details without affecting any client's own business branding.</p></div><div className="owner-website-shortcuts"><Link className="btn" href="/admin/website"><ArrowLeft size={16}/> Website overview</Link><Link className="btn btn-primary" href="/" target="_blank" rel="noopener noreferrer">Preview website <ExternalLink size={16}/></Link></div></header>
 <div className="owner-brand-layout"><section className="card card-pad"><BrandingForm brand={brand}/><BrandingAssets brand={brand}/></section><aside className="card card-pad owner-brand-side"><h2>Brand preview</h2><div className="owner-brand-example">{brand.logo_url?<img src={brand.logo_url} alt="Current platform logo" width={64} height={64}/>:<span className="brand-mark">{brand.short_name.slice(0,1).toUpperCase()}</span>}<div><strong>{brand.name}</strong><p>{brand.tagline}</p></div></div><p><strong>Support email:</strong> {brand.support_email||'Not set'}</p><p><strong>WhatsApp mobile:</strong> {brand.support_phone||'Not set'}</p>{chat?<a className="btn" href={chat} target="_blank" rel="noopener noreferrer">Test WhatsApp contact</a>:<p className="small muted">Add a mobile number to enable WhatsApp buttons on public pages.</p>}<p className="small muted">These settings are public. The uploaded files must be stored in the existing platform brand asset bucket.</p></aside></div>
 </main>;
}
