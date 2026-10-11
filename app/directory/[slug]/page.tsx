import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getServerSupabase} from '@/lib/server/supabase';
import {getPlatformBrand} from '@/lib/server/branding';
import PublicNav from '@/components/public-nav';
import PublicFooter from '@/components/public-footer';
export const dynamic='force-dynamic';
export default async function DirectoryProfile({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const [client,brand]=await Promise.all([getServerSupabase(),getPlatformBrand()]);
 if(!client)notFound();
 const {data:business}=await client.rpc('public_directory_profile',{p_slug:slug});
 if(!business)notFound();
 const email=business.directory_email?.trim()||'';
 const phone=business.directory_phone?.trim()||'';
 const whatsapp=(business.directory_whatsapp||'').replace(/\D/g,'');
 return <main className="marketing-site"><PublicNav name={brand.name} logo={brand.logo_url} access="guest"/><section className="marketing-section"><div className="marketing-container bo-directory-detail"><Link href="/directory">← All businesses</Link>{business.logo_url&&/^https:\/\//.test(business.logo_url)&&<img src={business.logo_url} alt="" className="bo-business-logo"/>}<span className="marketing-kicker">VERIFIED BUSINESS</span><h1>{business.name}</h1><p>{business.category}{business.city?` · ${business.city}`:''}{business.state?`, ${business.state}`:''}</p><p>{business.description||'Contact this business for more information.'}</p><div className="bo-directory-actions">{email&&<a className="btn btn-primary" href={`mailto:${email}`}>Email business</a>}{phone&&<a className="btn" href={`tel:${phone.replace(/[^0-9+]/g,'')}`}>Call business</a>}{whatsapp&&<a className="btn" href={`https://wa.me/${whatsapp}`} rel="noopener noreferrer" target="_blank">WhatsApp</a>}</div></div></section><PublicFooter name={brand.name} tagline={brand.tagline} email={brand.support_email}/></main>;
}
