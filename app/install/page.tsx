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
   <div className="install-intro"><span className="marketing-kicker">BUSINESSOS ON YOUR PHONE</span><h1>Keep your business one tap away.</h1><p>Add BusinessOS to your phone home screen. Open customers, orders and your dashboard without searching for the website every time.</p><div className="install-benefits"><span>✓ No app-store download required</span><span>✓ Works with your existing account</span><span>✓ Faster access from the home screen</span></div><Link href="/dashboard" className="marketing-btn-primary">Open my workspace →</Link></div>
   <div className="install-guide-panel"><img src="/app-icon-192.png" alt="BusinessOS app icon" width={88} height={88}/><h2>Add to Home Screen</h2><InstallAppGuide/></div>
  </div></section><PublicFooter name={brand.name} tagline={brand.tagline} email={brand.support_email}/>
 </main>;
}
