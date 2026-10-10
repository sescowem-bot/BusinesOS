import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {getPlatformBrand} from '@/lib/server/branding';
import {AdminNav} from '@/components/admin-nav';
import {signOut} from '../(auth)/login/actions';
export const dynamic='force-dynamic';
const areas=[{name:'Registered businesses',href:'/admin/businesses',desc:'Search real workspaces, view team roles and record internal reviews'},{name:'Plan feature access',href:'/admin/plan-access',desc:'Control premium modules available to approved business plans'},{name:'Upgrade approvals',href:'/admin/upgrades',desc:'Review and approve business plan changes'},{name:'Website content',href:'/admin/content',desc:'Edit public pages and publish or hide content'},{name:'Pricing plans',href:'/admin/content',desc:'Create and publish pricing cards from the CMS'},{name:'Admin notifications',href:'/admin/notifications',desc:'Read administrator alerts and upgrade decisions'},{name:'System diagnostics',href:'/admin/health',desc:'Check database access to platform and notification services'},{name:'Email templates',href:'/admin/email',desc:'Edit system email copy and review dynamic brand settings'},{name:'View website',href:'/',desc:'Review what visitors actually see'}];
export default async function AdminPage(){
 const session=await requirePlatformAdmin();
 if(!session)return <main className="admin-access"><div className="card card-pad"><h1>Platform administration</h1><p>Sign in with a registered platform administrator account.</p><Link className="btn btn-primary" href="/login">Sign in</Link></div></main>;
 const brand=await getPlatformBrand();
 const [pages,plans,unread]=await Promise.all([session.client.from('public_site_pages').select('slug,published'),session.client.from('public_site_plans').select('id,published'),session.client.from('user_notifications').select('id',{count:'exact',head:true}).eq('recipient_id',session.user.id).is('read_at',null)]);
 return <main className="admin-area"><header className="admin-header"><div><span className="badge badge-brand">Platform Super Admin</span><h1>Administration centre</h1><p><Link href="/admin/notifications" className="btn">Notifications {unread.count?`(${unread.count} unread)`:""}</Link></p><p>You are signed in as System Owner. Choose the area you want to manage. Website settings and customer businesses are separate.</p></div><form action={signOut}><button type="submit" className="btn">Sign out</button></form></header>
 <AdminNav active="home"/>
 <div className="admin-feature-choices">
  <Link href="/admin/website" className="card card-pad admin-choice"><span className="badge badge-brand">PUBLIC WEBSITE</span><h2>Manage Website →</h2><p>Platform identity, logo, pages, pricing cards, email templates and publishing.</p><strong>Open Website Management</strong></Link>
  <Link href="/admin/businesses" className="card card-pad admin-choice"><span className="badge badge-brand">REGISTERED BUSINESSES</span><h2>Manage Businesses →</h2><p>Registered workspaces, business memberships, subscription approvals, plan features and reviews.</p><strong>Open Business Management</strong></Link>
 </div>
 <div className="grid grid-3"><section className="card card-pad"><p className="small muted">CMS pages</p><h2>{pages.error?'Unavailable':pages.data?.length||0}</h2><p className="small muted">{pages.data?.filter(p=>p.published).length||0} published</p></section><section className="card card-pad"><p className="small muted">Pricing plans</p><h2>{plans.error?'Unavailable':plans.data?.length||0}</h2><p className="small muted">{plans.data?.filter(p=>p.published).length||0} published</p></section><section className="card card-pad"><p className="small muted">Administration session</p><h2>Authenticated</h2><p className="small muted">{session.user.email}</p></section></div>
 <div className="grid grid-3" style={{marginTop:18}}>{areas.map(item=><Link key={item.name} href={item.href} className="card card-pad" style={{textDecoration:'none',color:'inherit'}}><h2>{item.name} →</h2><p className="muted small">{item.desc}</p></Link>)}</div>
 {(pages.error||plans.error)&&<p role="alert" className="negative">CMS information could not be loaded. Check migrations and platform administrator access.</p>}
 <p className="small muted" style={{marginTop:18}}>Internal business reviews and member visibility are available in the business directory. Platform-wide user provisioning, account suspension, impersonation, media uploads and subscription billing are not implemented. Never treat a review note as an account restriction.</p>
</main>;
}
