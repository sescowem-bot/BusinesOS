import Link from 'next/link';
import {getServerSupabase} from '@/lib/server/supabase';
import {getPlatformBrand} from '@/lib/server/branding';
import PublicNav from '@/components/public-nav';
import PublicFooter from '@/components/public-footer';
export const dynamic='force-dynamic';
export default async function BusinessDirectory(){
 const [client,brand]=await Promise.all([getServerSupabase(),getPlatformBrand()]);
 const {data,error}=client?await client.rpc('public_directory_list'):{data:null,error:true};
 return <main className="marketing-site"><PublicNav name={brand.name} logo={brand.logo_url} access="guest"/><section className="marketing-section"><div className="marketing-container"><span className="marketing-kicker">BUSINESS DIRECTORY</span><h1>Discover verified businesses</h1><p>Explore businesses that have chosen to share their profiles publicly.</p><div className="grid grid-3" style={{marginTop:26}}>{(data||[]).map(b=><Link href={`/directory/${encodeURIComponent(b.slug)}`} className="card card-pad bo-directory-card" key={b.id}>{b.logo_url&&/^https:\/\//.test(b.logo_url)?<img src={b.logo_url} alt="" className="bo-business-logo"/>:<span className="bo-business-logo bo-business-logo-fallback">{b.name.slice(0,1)}</span>}<h2>{b.name}</h2><p className="small muted">{b.category}{b.city?` · ${b.city}`:''}{b.state?`, ${b.state}`:''}</p><p>{b.description||'View the business profile and contact details.'}</p><span className="small">View business →</span></Link>)}</div>{error&&<div className="card card-pad" role="alert">The business directory is temporarily unavailable. Please try again soon.</div>}{!error&&!data?.length&&<div className="card card-pad" style={{marginTop:24}}><h2>More businesses coming soon</h2><p>Verified businesses that choose public listing will appear here.</p></div>}</div></section><PublicFooter name={brand.name} tagline={brand.tagline} email={brand.support_email}/></main>;
}
