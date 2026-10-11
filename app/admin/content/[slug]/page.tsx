import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {defaultPages,type PublicPage} from '@/lib/server/public-cms';
import {PageEditor} from '../../cms-form';
import {ArrowLeft,ExternalLink} from 'lucide-react';
export const dynamic='force-dynamic';
export default async function EditPublicPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const fallback=defaultPages.find(p=>p.slug===slug);if(!fallback)notFound();
 const session=await requirePlatformAdmin();if(!session)return null;
 const {data,error}=await session.client.from('public_site_pages').select('*').eq('slug',slug).maybeSingle();
 const staleSeed=Boolean(data && Array.isArray(data.sections) && data.sections.length===1 &&
  data.sections[0]?.body==='Learn how this platform supports your business. Our team can customise this content from the CMS.');
 const staleHome=Boolean(data&&slug==='home'&&data.title==='Run your business with clarity. Grow with confidence.'&&
  data.description==='From customers and orders to accounting, stock and financial insights, bring the important parts of your business together in one thoughtful workspace.');
 const page:PublicPage=(staleSeed||staleHome?{...fallback,published:data?.published??fallback.published}:data&&!error?data:fallback) as PublicPage;
 const preview=slug==='home'?'/':`/${slug}`;
 return <main className="admin-area owner-editor-screen"><header className="admin-header"><div><Link className="owner-back-link" href="/admin/content"><ArrowLeft size={15}/> All website pages</Link><h1>{slug==='home'?'Homepage':slug.split('-').map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(' ')}</h1><p>Edit content in one place. Changes are published when you save a published page.</p></div>{page.published&&<Link href={preview} className="btn" target="_blank" rel="noopener noreferrer">Open public page <ExternalLink size={15}/></Link>}</header>
 {error&&<p className="owner-alert" role="alert">The current saved content could not be loaded. Please retry before saving changes.</p>}
 {!error&&(staleSeed||staleHome)&&<p className="owner-alert" role="status">This page still contains the original starter content. We have prepared clearer copy below. Review it before saving or publishing.</p>}
 {!error&&<div className="owner-editor-grid"><section className="card card-pad"><PageEditor key={slug} page={page}/></section><aside className="card card-pad owner-editor-notes"><h2>Page checklist</h2><p>Keep the headline specific, explain the benefit to customers, and include a clear next action.</p><p>Review the public page after saving. The product interface shows only functionality that has actually been released.</p><p>For business-specific pricing and permissions, use <Link href="/admin/plans">Pricing</Link> and <Link href="/admin/plan-access">Plan access</Link>.</p>{['privacy','terms','cookies'].includes(slug)&&<p><strong>Legal review:</strong> obtain approval of final policy text before publishing.</p>}</aside></div>}
 </main>;
}
