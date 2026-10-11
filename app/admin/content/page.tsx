import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {defaultPages} from '@/lib/server/public-cms';
import {ArrowRight, ExternalLink, FileText, PlusCircle} from 'lucide-react';
export const dynamic='force-dynamic';
const labels:Record<string,string>={home:'Homepage',features:'Features',solutions:'Solutions','how-it-works':'How it works',about:'About us',resources:'Resources',contact:'Contact',privacy:'Privacy notice',terms:'Terms of service',cookies:'Cookie notice'};
export default async function PagesAdmin(){
 const session=await requirePlatformAdmin();if(!session)return null;
 const {data,error}=await session.client.from('public_site_pages').select('slug,published,updated_at');
 const saved=new Map((data||[]).map(page=>[page.slug,page]));
 return <main className="admin-area owner-page-library"><header className="admin-header"><div><span className="owner-eyebrow"><FileText size={16}/> CONTENT MANAGEMENT</span><h1>Website pages</h1><p>Select a page to edit its heading, introduction and content sections. Pricing and brand assets have their own editors.</p></div><Link className="btn" href="/admin/website">Website overview</Link></header>
 {error&&<div className="owner-alert" role="alert">Website pages could not be loaded. Please try again before saving changes.</div>}
 {!error&&<><div className="owner-page-grid">{defaultPages.map(page=>{const item=saved.get(page.slug);const published=item?.published??page.published;return <article className="owner-page-card" key={page.slug}><div className="owner-page-card-top"><span className="owner-page-state" data-published={published?'true':'false'}>{published?'Published':'Draft'}</span><span className="small muted">/{page.slug==='home'?'':page.slug}</span></div><h2>{labels[page.slug]||page.title}</h2><p>{page.description}</p><div className="owner-page-card-actions"><Link className="btn btn-primary" href={`/admin/content/${page.slug}`}>Edit page <ArrowRight size={16}/></Link>{published&&<Link className="btn" href={page.slug==='home'?'/':`/${page.slug}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${labels[page.slug]||page.slug} on the website`}><ExternalLink size={16}/></Link>}</div></article>})}</div>
 <p className="owner-page-footnote"><PlusCircle size={15}/> To change subscription pricing, use <Link href="/admin/plans">Pricing plans</Link>. To change your brand name, colours, logo or WhatsApp, use <Link href="/admin/branding">Brand Studio</Link>.</p></>}
 </main>;
}
