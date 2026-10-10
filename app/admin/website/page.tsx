import Link from 'next/link';
import {ArrowRight, BookOpenText, CreditCard, ExternalLink, Globe2, Mail, MonitorCog, Palette, PenLine} from 'lucide-react';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {getPlatformBrand} from '@/lib/server/branding';
import {BrandingForm} from '../branding-form';
import {BrandingAssets} from '../branding-assets';

export const dynamic='force-dynamic';
const sections=[
 {title:'Website pages',detail:'Maintain headings, page sections, footer content and publication status.',href:'/admin/content',icon:PenLine},
 {title:'Pricing & packages',detail:'Create plans, publish pricing and compare real feature access.',href:'/admin/plans',icon:CreditCard},
 {title:'Email communication',detail:'Manage branded email templates and notification messages.',href:'/admin/email',icon:Mail},
 {title:'View public website',detail:'Check how visitors experience your latest published content.',href:'/',icon:ExternalLink},
 {title:'System diagnostics',detail:'Inspect the availability of platform services and database records.',href:'/admin/health',icon:MonitorCog},
];
export default async function WebsiteManagement(){
 const session=await requirePlatformAdmin();
 if(!session)return <main className="admin-area" role="alert">Administrator access required.</main>;
 const [brand,pages,plans]=await Promise.all([
  getPlatformBrand(),
  session.client.from('public_site_pages').select('slug,published'),
  session.client.from('public_site_plans').select('id,published')
 ]);
 return <main className="admin-area owner-website-hub">
 <header className="admin-header"><div><span className="owner-eyebrow"><Globe2 size={15}/> WEBSITE MANAGEMENT</span><h1>Your public website</h1><p>Keep your platform identity, messaging and pages consistent across the entire customer experience. Your saved CMS values remain the source of truth.</p></div><Link href="/" className="btn btn-primary"><ExternalLink size={15}/> Open website</Link></header>
 {(pages.error||plans.error)&&<section className="owner-alert" role="alert"><MonitorCog size={18}/><div><strong>Some publishing information could not be verified</strong><p>Inspect database access before making changes to public content.</p></div><Link href="/admin/health">Diagnostics <ArrowRight size={15}/></Link></section>}
 <div className="owner-stat-grid owner-website-stats"><Link href="/admin/content" className="owner-stat-card"><div className="owner-stat-label"><span>Website pages</span><span className="owner-stat-icon"><BookOpenText size={19}/></span></div><strong>{pages.error?'—':pages.data?.length||0}</strong><small>Saved CMS pages</small></Link><Link href="/admin/content" className="owner-stat-card"><div className="owner-stat-label"><span>Published pages</span><span className="owner-stat-icon"><Globe2 size={19}/></span></div><strong>{pages.error?'—':(pages.data||[]).filter(p=>p.published).length}</strong><small>Visible according to publication settings</small></Link><Link href="/admin/plans" className="owner-stat-card"><div className="owner-stat-label"><span>Public pricing plans</span><span className="owner-stat-icon"><CreditCard size={19}/></span></div><strong>{plans.error?'—':(plans.data||[]).filter(p=>p.published).length}</strong><small>Published subscription packages</small></Link><Link href="/admin/email" className="owner-stat-card"><div className="owner-stat-label"><span>Platform identity</span><span className="owner-stat-icon"><Palette size={19}/></span></div><strong className="owner-identity-value">Configured</strong><small>Managed from the branding form below</small></Link></div>
 <section className="owner-panel" style={{marginBottom:22}}><div className="owner-panel-heading"><div><h2>Website tools</h2><p>Choose the area you want to update</p></div></div><div className="owner-management-grid" style={{padding:17,margin:0}}>{sections.map(item=>{const Icon=item.icon;return <Link key={item.href} href={item.href} className="owner-management-card"><Icon size={22}/><strong>{item.title}</strong><small>{item.detail}</small><span className="owner-management-action">Open tool <ArrowRight size={14}/></span></Link>})}</div></section>
 <div className="admin-layout"><section className="card card-pad"><div className="owner-management-heading"><span><Palette size={21}/></span><div><h2 style={{margin:0}}>Platform appearance and branding</h2><p className="muted small">Update the identity used across your public pages and email templates.</p></div></div><BrandingForm brand={brand}/><BrandingAssets brand={brand}/></section><aside className="card card-pad"><h2>Current brand identity</h2><div className="brand-preview"><div className="brand-mark">{brand.logo_url?<img src={brand.logo_url} width={42} height={42} alt="" style={{width:42,height:42,objectFit:'contain'}}/>:brand.short_name.slice(0,1).toUpperCase()}</div><strong>{brand.name}</strong><p>{brand.tagline}</p></div><div className="owner-brand-swatches"><span title="Primary colour" style={{backgroundColor:brand.primary_color}}/><span title="Accent colour" style={{backgroundColor:brand.accent_color}}/></div><p className="muted small">Your brand name, logo, theme colours and support contact are retrieved from your platform settings.</p><p className="muted small">Public legal policies require approved content. Publishing a placeholder does not make it legally reviewed.</p></aside></div>
 </main>;
}
