import Link from 'next/link';
import {ArrowRight,ExternalLink,Globe2,Mail,Palette,PenLine,CreditCard,MessageCircle} from 'lucide-react';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {getPlatformBrand} from '@/lib/server/branding';
import {whatsappUrl} from '@/lib/public-contact';
export const dynamic='force-dynamic';
const tools=[
 {title:'Brand Studio',description:'Change your platform name, logo, favicon, colours, email and WhatsApp contact.',href:'/admin/branding',icon:Palette},
 {title:'Page editor',description:'Edit the homepage, product pages, solutions, about, contact and legal pages individually.',href:'/admin/content',icon:PenLine},
 {title:'Plans & pricing',description:'Set subscriptions, public prices and marketing benefits.',href:'/admin/plans',icon:CreditCard},
 {title:'Plan features & staff roles',description:'Choose exactly what a subscription unlocks for a business and its team.',href:'/admin/plan-access',icon:Globe2},
 {title:'Email templates',description:'Edit system emails and notification templates.',href:'/admin/email',icon:Mail},
 ];
export default async function WebsiteManagement(){
 const session=await requirePlatformAdmin();if(!session)return null;
 const [brand,pageResult,planResult]=await Promise.all([getPlatformBrand(),session.client.from('public_site_pages').select('slug,published'),session.client.from('public_site_plans').select('id,published')]);
 const chat=whatsappUrl(brand.support_phone,`Hello ${brand.name}, I have a question.`);
 return <main className="admin-area owner-website-hub"><header className="admin-header"><div><span className="owner-eyebrow"><Globe2 size={16}/> YOUR PUBLIC WEBSITE</span><h1>Website management</h1><p>Manage the brand customers see, the pages that explain your product, and how visitors can contact your team.</p></div><Link href="/" target="_blank" rel="noopener noreferrer" className="btn btn-primary">Preview website <ExternalLink size={16}/></Link></header>
 <div className="owner-website-focus-grid"><div><span>Platform name</span><strong>{brand.name}</strong><Link href="/admin/branding">Edit branding <ArrowRight size={14}/></Link></div><div><span>Published pages</span><strong>{pageResult.error?'—':`${(pageResult.data||[]).filter(x=>x.published).length} pages`}</strong><Link href="/admin/content">Edit pages <ArrowRight size={14}/></Link></div><div><span>Published plans</span><strong>{planResult.error?'—':`${(planResult.data||[]).filter(x=>x.published).length} plans`}</strong><Link href="/admin/plans">Manage plans <ArrowRight size={14}/></Link></div><div><span>Customer contact</span><strong>{chat?'WhatsApp ready':brand.support_email?'Email available':'Not configured'}</strong><Link href="/admin/branding">Update contact <ArrowRight size={14}/></Link></div></div>
 <section className="owner-panel"><div className="owner-panel-heading"><div><h2>Choose what you want to manage</h2><p>Each part of your website has its own workspace.</p></div></div><div className="owner-website-tools">{tools.map(({title,description,href,icon:Icon})=><Link key={href} href={href} className="owner-website-tool"><span><Icon size={23}/></span><strong>{title}</strong><small>{description}</small><span className="owner-website-tool-link">Open editor <ArrowRight size={14}/></span></Link>)}</div></section>
 <section className="owner-website-next"><div><h2>Make it easy for visitors to get in touch</h2><p>Add a public support email and WhatsApp mobile number in Brand Studio. They appear on the Contact page, website footer and floating contact shortcut. No third-party chat service is needed.</p></div><Link className="btn btn-primary" href="/admin/branding"><MessageCircle size={17}/> Configure contact</Link></section>
 </main>;
}
