import Link from 'next/link';
import {AdminNav} from '@/components/admin-nav';
import {requirePlatformAdmin} from '@/lib/server/supabase';
export const dynamic='force-dynamic';
type BusinessRow={business_id:string;business_name:string;category:string;created_at:string;owner_count:number;member_count:number;approved_plan:string|null;pending_upgrades:number};
export default async function AdminBusinesses({searchParams}:{searchParams:Promise<{q?:string|string[]}>}){
 const session=await requirePlatformAdmin();
 if(!session)return <main className="admin-access"><section className="card card-pad"><h1>Platform administrator access required</h1><Link href="/login">Sign in</Link></section></main>;
 const raw=(await searchParams).q;
 const query=(typeof raw==='string'?raw:'').trim().slice(0,100).toLocaleLowerCase();
 const {data,error}=await session.client.rpc('platform_business_directory');
 const businesses=((data||[]) as BusinessRow[]);
 const filtered=businesses.filter(b=>!query||b.business_name.toLocaleLowerCase().includes(query)||b.category.toLocaleLowerCase().includes(query));
 return <main className="admin-area">
  <AdminNav active="businesses"/>
  <header className="admin-header"><div><span className="badge badge-brand">SYSTEM OWNER / BUSINESSES</span><h1>Business directory</h1><p>Explore real organisations, teams, approved plans and upgrade requests without accessing private customer transactions.</p></div><Link className="btn" href="/admin">← Administration</Link></header>
  <div className="admin-operations-links"><Link className="btn btn-primary" href="/admin/upgrades">Upgrade Approvals</Link><Link className="btn" href="/admin/plan-access">Plan Permissions</Link><Link className="btn" href="/admin/notifications">Administrator Notifications</Link></div>
  <div className="grid grid-3"><section className="card card-pad"><p className="small muted">Registered businesses</p><h2>{error?'Unavailable':businesses.length}</h2></section><section className="card card-pad"><p className="small muted">Business memberships</p><h2>{error?'Unavailable':businesses.reduce((s,b)=>s+Number(b.member_count),0)}</h2></section><section className="card card-pad"><p className="small muted">Pending plan reviews</p><h2>{error?'Unavailable':businesses.reduce((s,b)=>s+Number(b.pending_upgrades),0)}</h2></section></div>
  {error&&<section className="card card-pad" role="alert"><h2>Business records cannot be loaded</h2><p>{error.message}</p><p>Confirm migration 018 and active Platform Admin membership.</p></section>}
  {!error&&<section className="card card-pad" style={{marginTop:20}}><div className="admin-header"><div><h2>Organisations</h2><p className="small muted">Select a business to review contact details, team memberships and administrative notes.</p></div><form method="get" action="/admin/businesses" className="admin-form" style={{minWidth:200}}><label htmlFor="business-search">Search name or category<input id="business-search" name="q" defaultValue={query} maxLength={100} placeholder="Search businesses"/></label><button className="btn" type="submit">Search</button></form></div>
   <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th align="left">Business</th><th align="left">Industry</th><th align="left">Members</th><th align="left">Current plan</th><th align="left">Upgrade requests</th></tr></thead><tbody>{filtered.map(b=><tr key={b.business_id}><td style={{padding:'12px 8px'}}><Link href={`/admin/businesses/${encodeURIComponent(b.business_id)}`}><strong>{b.business_name} →</strong></Link><div className="small muted">Created {new Date(b.created_at).toLocaleDateString('en-NG')}</div></td><td>{b.category}</td><td>{b.member_count} ({b.owner_count} owners)</td><td>{b.approved_plan||'Not assigned'}</td><td>{Number(b.pending_upgrades)>0?<Link href="/admin/upgrades">{b.pending_upgrades} pending →</Link>:'—'}</td></tr>)}</tbody></table></div>
   {!filtered.length&&<p className="muted">{query?'No businesses match that search.':'No registered business workspaces yet.'}</p>}
  </section>}
  <p className="small muted" style={{marginTop:16}}>Business details and internal review notes are restricted to active Platform Admins. No suspension or impersonation controls are exposed.</p>
 </main>;
}
