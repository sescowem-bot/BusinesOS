import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {getPlatformBrand} from '@/lib/server/branding';
import {AdminNav} from '@/components/admin-nav';
import {BrandingForm} from '../branding-form';
export const dynamic='force-dynamic';
const sections=[
 {title:'Public Pages',detail:'Edit section titles, copy and publication status.',href:'/admin/content'},
 {title:'Pricing & Plans',detail:'Manage pricing cards and public plan information.',href:'/admin/plans'},
 {title:'Email Templates',detail:'Edit message templates and branded email content.',href:'/admin/email'},
 {title:'Platform Diagnostics',detail:'Check CMS and configuration availability.',href:'/admin/health'}
];
export default async function WebsiteManagement(){
 const session=await requirePlatformAdmin();
 if(!session)return <main className="admin-access"><section className="card card-pad"><h1>Platform administrator access required</h1><p>Only active System Owners can manage the public website.</p><Link href="/login">Sign in</Link></section></main>;
 const brand=await getPlatformBrand();
 return <main className="admin-area"><header className="admin-header"><div><span className="badge badge-brand">SYSTEM OWNER / WEBSITE</span><h1>Website Management</h1><p>Control how your platform appears to visitors. Changes to published content are reflected on the public website.</p></div><Link href="/" className="btn">View Website ↗</Link></header>
 <AdminNav active="website"/>
 <div className="admin-feature-choices">{sections.map(s=><Link className="card card-pad admin-choice" key={s.title} href={s.href}><h2>{s.title} →</h2><p>{s.detail}</p></Link>)}</div>
 <div className="admin-layout" style={{marginTop:20}}><section className="card card-pad"><BrandingForm brand={brand}/></section><aside className="card card-pad"><h2>Current platform identity</h2><div className="brand-preview"><div className="brand-mark">{brand.short_name.slice(0,1).toUpperCase()}</div><strong>{brand.name}</strong><p>{brand.tagline}</p></div><p className="small muted">Branding values come from Super Admin configuration and are not hardcoded into new administration controls.</p></aside></div>
 </main>;
}
