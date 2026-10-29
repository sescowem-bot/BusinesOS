import Link from 'next/link';
import {Palette,ArrowLeft,ExternalLink} from 'lucide-react';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {getPlatformBrand} from '@/lib/server/branding';
import {BrandingForm} from '../branding-form';
import {BrandingAssets} from '../branding-assets';
import './appearance-studio.css';
export const dynamic='force-dynamic';
export default async function PlatformBrandStudio(){
 const session=await requirePlatformAdmin();if(!session)return null;
 const brand=await getPlatformBrand();
 return <main className="admin-area owner-brand-studio"><header className="admin-header"><div><span className="owner-eyebrow"><Palette size={16}/> BRAND &amp; APPEARANCE</span><h1>Make BusinessOS your brand</h1><p>Choose your platform identity, colours, logo and app icon. Customer businesses retain their own independent branding.</p></div><div className="owner-website-shortcuts"><Link className="btn" href="/admin/website"><ArrowLeft size={16}/> Website overview</Link><Link className="btn btn-primary" href="/" target="_blank" rel="noopener noreferrer">Preview website <ExternalLink size={16}/></Link></div></header>
  <section className="card card-pad bo-brand-studio-main"><BrandingForm brand={brand}/><BrandingAssets brand={brand}/></section>
 </main>;
}
