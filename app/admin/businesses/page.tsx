import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
export const dynamic='force-dynamic';
type BusinessRow={business_id:string;business_name:string;category:string;created_at:string;owner_count:number;member_count:number;approved_plan:string|null;pending_upgrades:number};
export default async function AdminBusinesses(){
 const session=await requirePlatformAdmin();
 if(!session) return <main className="admin-access"><section className="card card-pad"><h1>Platform administrator access required</h1><Link href="/login">Sign in</Link></section></main>;
 const {data,error}=await session.client.rpc('platform_business_directory');
 const businesses=(data||[]) as BusinessRow[];
 return <main className="admin-area">
  <header className="admin-header"><div><span className="badge badge-brand">SYSTEM OWNER / BUSINESSES</span><h1>Business directory</h1><p>View registered organisations, memberships, approved plans and requests. All records are read from Supabase.</p></div><Link className="btn" href="/admin">← Administration</Link></header>
  <div className="grid grid-3">
   <section className="card card-pad"><p className="small muted">Registered businesses</p><h2>{error?'Unavailable':businesses.length}</h2></section>
   <section className="card card-pad"><p className="small muted">Business memberships</p><h2>{error?'Unavailable':businesses.reduce((s,b)=>s+Number(b.member_count),0)}</h2></section>
   <section className="card card-pad"><p className="small muted">Pending plan reviews</p><h2>{error?'Unavailable':businesses.reduce((s,b)=>s+Number(b.pending_upgrades),0)}</h2></section>
  </div>
  {error&&<section className="card card-pad" role="alert"><h2>Business records cannot be loaded</h2><p>{error.message}</p><p>Apply migration 018 and confirm your account is active in platform_admins.</p></section>}
  {!error&&<section className="card card-pad" style={{marginTop:20}}><h2>Organisations</h2><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th align="left">Business</th><th align="left">Industry</th><th align="left">Members</th><th align="left">Current plan</th><th align="left">Upgrade requests</th></tr></thead><tbody>{businesses.map(b=><tr key={b.business_id}><td style={{padding:'12px 8px'}}><strong>{b.business_name}</strong><div className="small muted">Created {new Date(b.created_at).toLocaleDateString('en-NG')}</div></td><td>{b.category}</td><td>{b.member_count} ({b.owner_count} owners)</td><td>{b.approved_plan||'Not assigned'}</td><td>{Number(b.pending_upgrades)>0?<Link href="/admin/upgrades">{b.pending_upgrades} pending →</Link>:'—'}</td></tr>)}</tbody></table></div>{!businesses.length&&<p className="muted">No registered business workspaces yet.</p>}</section>}
  <p className="small muted" style={{marginTop:16}}>Read-only directory. Business deletion, impersonation and plan changes are intentionally not available here. Upgrades require explicit administrator approval.</p>
 </main>;
}
