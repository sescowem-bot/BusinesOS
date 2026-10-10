import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {getPlatformBrand} from '@/lib/server/branding';
import {BrandingForm} from './branding-form';
import {signOut} from '../(auth)/login/actions';
export const dynamic='force-dynamic';
const areas=[{name:'Registered businesses',href:'/admin/businesses',desc:'View real workspaces, membership counts and assigned plans'},{name:'Plan feature access',href:'/admin/plan-access',desc:'Control premium modules available to approved business plans'},{name:'Upgrade approvals',href:'/admin/upgrades',desc:'Review and approve business plan changes'},{name:'Website content',href:'/admin/content',desc:'Edit public pages and publish or hide content'},{name:'Pricing plans',href:'/admin/content',desc:'Create and publish pricing cards from the CMS'},{name:'Email templates',href:'/admin/email',desc:'Edit system email copy and review dynamic brand settings'},{name:'View website',href:'/',desc:'Review what visitors actually see'}];
export default async function AdminPage(){
 const session=await requirePlatformAdmin();
 if(!session)return <main className="admin-access"><div className="card card-pad"><h1>Platform administration</h1><p>Sign in with a registered platform administrator account.</p><Link className="btn btn-primary" href="/login">Sign in</Link></div></main>;
 const brand=await getPlatformBrand();
 const [pages,plans]=await Promise.all([session.client.from('public_site_pages').select('slug,published'),session.client.from('public_site_plans').select('id,published')]);
 return <main className="admin-area"><header className="admin-header"><div><span className="badge badge-brand">Platform Super Admin</span><h1>Administration centre</h1><p>Manage the public identity and publishing for {brand.name}. This is separate from each business owner dashboard.</p></div><form action={signOut}><button type="submit" className="btn">Sign out</button></form></header>
 <div className="grid grid-3"><section className="card card-pad"><p className="small muted">CMS pages</p><h2>{pages.error?'Unavailable':pages.data?.length||0}</h2><p className="small muted">{pages.data?.filter(p=>p.published).length||0} published</p></section><section className="card card-pad"><p className="small muted">Pricing plans</p><h2>{plans.error?'Unavailable':plans.data?.length||0}</h2><p className="small muted">{plans.data?.filter(p=>p.published).length||0} published</p></section><section className="card card-pad"><p className="small muted">Administration session</p><h2>Authenticated</h2><p className="small muted">{session.user.email}</p></section></div>
 <div className="grid grid-3" style={{marginTop:18}}>{areas.map(item=><Link key={item.name} href={item.href} className="card card-pad" style={{textDecoration:'none',color:'inherit'}}><h2>{item.name} →</h2><p className="muted small">{item.desc}</p></Link>)}</div>
 {(pages.error||plans.error)&&<p role="alert" className="negative">CMS information could not be loaded. Check migrations and platform administrator access.</p>}
 <p className="small muted" style={{marginTop:18}}>Platform user directory, support impersonation, business moderation, media uploads and subscription billing are not yet implemented. These controls are intentionally not shown as working features.</p>
 <div className="admin-layout" style={{marginTop:18}}><section className="card card-pad"><BrandingForm brand={brand}/></section><aside className="card card-pad"><h2>Brand preview</h2><div className="brand-preview"><div className="brand-mark">{brand.short_name.slice(0,1).toUpperCase()}</div><strong>{brand.name}</strong><p>{brand.tagline}</p></div></aside></div></main>;
}
