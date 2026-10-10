import Link from 'next/link';
import {ClipboardCheck,ArrowRight, BellRing, Building2, CheckCircle2, CreditCard, FileText, Globe2, Mail, MonitorCog, ShieldCheck, UsersRound, Wallet} from 'lucide-react';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {getPlatformBrand} from '@/lib/server/branding';

export const dynamic='force-dynamic';
type DirectoryRow={business_id:string;business_name:string;created_at:string;member_count:number;approved_plan:string|null;pending_upgrades:number};
const tools=[
 {name:'Website content',detail:'Maintain pages, messaging and publication status.',href:'/admin/content',icon:FileText},
 {name:'Subscription plans',detail:'Configure pricing packages and plan details.',href:'/admin/plans',icon:CreditCard},
 {name:'Feature permissions',detail:'Control module and team-role entitlements.',href:'/admin/plan-access',icon:ShieldCheck},
 {name:'Email templates',detail:'Review branded notifications and delivery settings.',href:'/admin/email',icon:Mail},
 {name:'System health',detail:'Check data services and administration readiness.',href:'/admin/health',icon:MonitorCog},
 {name:'Customer assistance',detail:'Review support requests and owner-authorised staff role changes.',href:'/admin/support',icon:UsersRound},
 {name:'Pilot readiness',detail:'Record launch tests, blockers and evidence with an audit trail.',href:'/admin/pilot',icon:ClipboardCheck},
];
export default async function AdminPage(){
 const session=await requirePlatformAdmin();
 if(!session)return <div role="alert" className="card card-pad">You must sign in as an active Platform Administrator.</div>;
 const [brand,pages,plans,directory,requests,unread]=await Promise.all([
  getPlatformBrand(),
  session.client.from('public_site_pages').select('slug,published'),
  session.client.from('public_site_plans').select('id,published'),
  session.client.rpc('platform_business_directory'),
  session.client.from('business_upgrade_requests').select('id,business_id,plan_id,requested_at').eq('status','pending').order('requested_at',{ascending:false}).limit(4),
  session.client.from('user_notifications').select('id',{count:'exact',head:true}).eq('recipient_id',session.user.id).is('read_at',null)
 ]);
 const businesses:DirectoryRow[]=directory.error?[]:((directory.data||[]) as DirectoryRow[]);
 const recentlyJoined=[...businesses].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,5);
 const businessNames=new Map(businesses.map(b=>[b.business_id,b.business_name]));
 const incomplete=Boolean(pages.error||plans.error||directory.error||requests.error);
 const stats=[
  {name:'Registered businesses',value:directory.error?'—':String(businesses.length),caption:'Business workspaces',icon:Building2,href:'/admin/businesses'},
  {name:'Published pages',value:pages.error?'—':String((pages.data||[]).filter(p=>p.published).length),caption:pages.error?'Data unavailable':`of ${pages.data?.length||0} CMS pages`,icon:Globe2,href:'/admin/content'},
  {name:'Subscription plans',value:plans.error?'—':String(plans.data?.length||0),caption:plans.error?'Data unavailable':`${(plans.data||[]).filter(p=>p.published).length} publicly visible`,icon:CreditCard,href:'/admin/plans'},
  {name:'Pending approvals',value:directory.error?'—':String(businesses.reduce((s,b)=>s+Number(b.pending_upgrades||0),0)),caption:'Upgrade requests awaiting review',icon:UsersRound,href:'/admin/upgrades'},
 ];
 return <main className="admin-area owner-dashboard">
  <div className="owner-page-heading"><div><div className="owner-eyebrow"><ShieldCheck size={14}/> PLATFORM CONTROL CENTRE</div><h1>Welcome to your command centre</h1><p>Manage {brand.name} in one place, from website content to customer businesses and subscription approvals.</p></div><Link href="/admin/health" className="btn owner-action-outline"><MonitorCog size={16}/> System health</Link></div>
  {incomplete&&<div className="owner-alert" role="alert"><MonitorCog size={19}/><div><strong>Some platform information is unavailable</strong><p>Figures shown as dashes are not verified. Check your database functions, migrations and administrator permissions.</p></div><Link href="/admin/health">Diagnostics <ArrowRight size={15}/></Link></div>}
  <div className="owner-stat-grid">{stats.map(s=>{const Icon=s.icon;return <Link href={s.href} className="owner-stat-card" key={s.name}><div className="owner-stat-label"><span>{s.name}</span><span className="owner-stat-icon"><Icon size={19}/></span></div><strong>{s.value}</strong><small>{s.caption}</small></Link>})}</div>
  <div className="owner-section-title"><div><h2>Your management workspaces</h2><p>Dedicated tools for the platform, its customers and your own business.</p></div></div>
  <div className="owner-destination-grid">
   <Link href="/admin/website" className="owner-destination owner-destination-website"><span className="owner-destination-icon"><Globe2 size={24}/></span><span className="owner-destination-body"><span>PUBLIC EXPERIENCE</span><strong>Manage Website</strong><small>Update branding, content, pricing and communication templates.</small></span><span className="owner-destination-arrow"><ArrowRight size={20}/></span></Link>
   <Link href="/admin/businesses" className="owner-destination owner-destination-business"><span className="owner-destination-icon"><Building2 size={24}/></span><span className="owner-destination-body"><span>PLATFORM OPERATIONS</span><strong>Manage Businesses</strong><small>Explore registered customers, plans, reviews and approvals.</small></span><span className="owner-destination-arrow"><ArrowRight size={20}/></span></Link>
   <Link href="/admin/my-business" className="owner-destination owner-destination-personal"><span className="owner-destination-icon"><Wallet size={24}/></span><span className="owner-destination-body"><span>YOUR BUSINESS</span><strong>My Business Dashboard</strong><small>Open your own business workspace with its normal operating tools.</small></span><span className="owner-destination-arrow"><ArrowRight size={20}/></span></Link>
  </div>
  <div className="owner-overview-columns">
   <section className="owner-panel"><div className="owner-panel-heading"><div><h2>Recently registered businesses</h2><p>Latest workspaces from your database</p></div><Link href="/admin/businesses">View all <ArrowRight size={15}/></Link></div>
    {directory.error?<p role="alert" className="owner-empty">Business directory could not be loaded.</p>:recentlyJoined.length?<div className="owner-recent-list">{recentlyJoined.map((b,i)=><Link key={b.business_id} href={`/admin/businesses/${encodeURIComponent(b.business_id)}`} className="owner-recent-row"><span className="owner-business-avatar" aria-hidden="true">{b.business_name.slice(0,1).toUpperCase()}</span><span className="owner-recent-info"><strong>{b.business_name}</strong><small>{Number(b.member_count)} members · {b.approved_plan||'No approved plan'}</small></span><time dateTime={b.created_at}>{Number.isNaN(Date.parse(b.created_at))?'—':new Date(b.created_at).toLocaleDateString('en-NG')}</time><ArrowRight size={16}/></Link>)}</div>:<div className="owner-empty">No registered businesses yet. They will appear here after onboarding.</div>}
   </section>
   <section className="owner-panel"><div className="owner-panel-heading"><div><h2>Needs your attention</h2><p>Real pending reviews and alerts</p></div><Link href="/admin/upgrades">Review all <ArrowRight size={15}/></Link></div>
     {requests.error?<div className="owner-empty">Unable to load pending approvals.</div>:requests.data?.length?<div className="owner-recent-list">{requests.data.map(r=><Link href="/admin/upgrades" className="owner-attention-row" key={r.id}><span className="owner-attention-icon"><CreditCard size={17}/></span><span><strong>{businessNames.get(r.business_id)||'Business upgrade request'}</strong><small>Requested plan: {r.plan_id}</small></span><ArrowRight size={16}/></Link>)}</div>:<div className="owner-zero-state"><CheckCircle2 size={25}/><strong>No outstanding upgrade requests</strong><small>New requests will appear here for your review.</small></div>}
     {unread.error?<p className="owner-panel-note">Notifications are temporarily unavailable.</p>:unread.count?<Link href="/admin/notifications" className="owner-notification-line"><BellRing size={16}/> {unread.count} unread notification{unread.count===1?'':'s'} <ArrowRight size={15}/></Link>:<Link href="/admin/notifications" className="owner-notification-line"><BellRing size={16}/> Notification centre <ArrowRight size={15}/></Link>}
   </section>
  </div>
  <section className="owner-panel owner-quick-panel"><div className="owner-panel-heading"><div><h2>Quick management tools</h2><p>Common tasks in one place</p></div></div><div className="owner-quick-grid">{tools.map(item=>{const Icon=item.icon;return <Link href={item.href} key={item.name} className="owner-quick-item"><span><Icon size={19}/></span><div><strong>{item.name}</strong><small>{item.detail}</small></div><ArrowRight size={16}/></Link>})}</div></section>
  <p className="owner-page-footnote">Business counts, activity and approvals reflect accessible database records. Customer financial information remains protected by business membership and role permissions.</p>
 </main>;
}
