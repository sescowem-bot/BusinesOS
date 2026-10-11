import Link from 'next/link';
import {getPlatformBrand} from '@/lib/server/branding';
import PublicNav from '@/components/public-nav';
import PublicFooter from '@/components/public-footer';
import {InstallAppGuide} from '@/components/install-app-guide';
export const revalidate=60;
export default async function InstallPage(){
 const brand=await getPlatformBrand();
 return <main className="marketing-site"><PublicNav name={brand.name} logo={brand.logo_url} access="guest"/>
  <section className="marketing-section"><div className="marketing-container install-page-layout">
   <div className="install-intro"><span className="marketing-kicker">YOUR BUSINESS APP</span><h1>Your business, one tap away.</h1><p>Add {brand.name} to your phone or computer. Open customers, orders and your dashboard straight from your Home Screen.</p><div className="install-benefits"><span>✓ Add from Chrome or Safari on iPhone</span><span>✓ Works with your existing account</span><span>✓ Faster access from the home screen</span></div><Link href="/dashboard" className="marketing-btn-primary">Open my workspace →</Link></div>
   <div className="install-guide-panel"><img src="/app-icon-192.png" alt={`${brand.name} app icon`} width={88} height={88}/><h2>Add to Home Screen</h2><InstallAppGuide name={brand.name}/></div>
  </div></section><PublicFooter name={brand.name} tagline={brand.tagline} email={brand.support_email}/>
 </main>;
}
