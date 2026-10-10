import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {BusinessReviewForm} from './review-form';
import {FeatureGrantForm} from './feature-grant-form';
import {paidCapabilities} from '@/lib/plan-catalog';
export const dynamic='force-dynamic';
type Member={user_id:string;full_name:string|null;role:string;joined_at:string};
type Review={status:string;note:string;updated_at:string};
type History={status:string;changed_at:string};
type Detail={id:string;name:string;slug:string;category:string;email:string|null;phone:string|null;city:string|null;state:string|null;country:string;created_at:string;published:boolean;verified:boolean;plan_id:string|null;members:Member[];pending_upgrades:number;review:Review|null;review_history:History[]};
export default async function BusinessDetails({params}:{params:Promise<{id:string}>}){
 const session=await requirePlatformAdmin();
 if(!session)return <main className="admin-access"><h1>Platform administrator access required</h1><Link href="/login">Sign in</Link></main>;
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 const {data,error}=await session.client.rpc('platform_business_detail',{p_business_id:id});
 if(error)return <main className="admin-area"><Link href="/admin/businesses">← Business directory</Link><section className="card card-pad" role="alert"><h1>Unable to load business</h1><p>{error.message}</p><p className="muted">Confirm migration 021 is installed and you are an active Platform Admin.</p></section></main>;
 if(!data)notFound();
 const b=data as Detail;
 const [grantsResult,auditResult]=await Promise.all([
  session.client.from('business_feature_grants').select('feature_key,enabled,allowed_roles,expires_at,note,updated_at').eq('business_id',id).order('feature_key'),
  session.client.from('business_feature_grant_audit').select('id,feature_key,changed_at,changed_by').eq('business_id',id).order('changed_at',{ascending:false}).limit(20)
 ]);
 const grants=(grantsResult.data||[]) as {feature_key:string;enabled:boolean;allowed_roles:string[];expires_at:string|null;note:string;updated_at:string}[];
 return <main className="admin-area">
  <header className="admin-header"><div><Link href="/admin/businesses">← Business directory</Link><span className="badge badge-brand">PLATFORM ADMIN / BUSINESS</span><h1>{b.name}</h1><p>{b.slug} · {b.category} · Created {new Date(b.created_at).toLocaleDateString('en-NG')}</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link href="/admin/support" className="btn">Support & role requests</Link><Link href="/admin/upgrades" className="btn">Review upgrades</Link></div></header>
  <div className="grid grid-3"><section className="card card-pad"><p className="small muted">Members</p><h2>{b.members.length}</h2></section><section className="card card-pad"><p className="small muted">Approved plan</p><h2>{b.plan_id||'Unassigned'}</h2></section><section className="card card-pad"><p className="small muted">Pending upgrades</p><h2>{b.pending_upgrades}</h2></section></div>
  <div className="grid grid-2" style={{marginTop:20}}>
   <section className="card card-pad"><h2>Workspace information</h2><p><strong>Email:</strong> {b.email||'Not provided'}</p><p><strong>Phone:</strong> {b.phone||'Not provided'}</p><p><strong>Location:</strong> {[b.city,b.state,b.country].filter(Boolean).join(', ')||'Not provided'}</p><p><strong>Publicly listed:</strong> {b.published?'Yes':'No'}</p><p><strong>Verified flag:</strong> {b.verified?'Yes':'No'}</p><p className="muted small">These values are read-only here. Account suspension, impersonation and irreversible deletion are not available.</p></section>
   <section className="card card-pad"><BusinessReviewForm businessId={b.id} status={b.review?.status||'open'} note={b.review?.note||''}/></section>
  </div>
  <section className="card card-pad" style={{marginTop:20}}><h2>Business team</h2><div style={{overflowX:'auto'}}><table style={{width:'100%'}}><thead><tr><th align="left">Member</th><th align="left">Role</th><th align="left">Joined</th></tr></thead><tbody>{b.members.map(m=><tr key={m.user_id}><td style={{padding:'10px 6px'}}>{m.full_name?.trim()||'Name not provided'}<div className="small muted">{m.user_id}</div></td><td>{m.role}</td><td>{new Date(m.joined_at).toLocaleDateString('en-NG')}</td></tr>)}</tbody></table></div>{!b.members.length&&<p>No members found.</p>}</section>
  <section className="card card-pad" style={{marginTop:20}}><h2>Business-specific feature access</h2><p className="muted">Individual add-ons are independent of the approved subscription. Granting a module here doesn't affect other businesses. Revoking an add-on cannot remove features inherited from the current plan.</p>
   {grantsResult.error?<p role="alert">Feature grants unavailable. Apply SQL migration 029 before changing add-ons.</p>:<><div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Module</th><th>Status</th><th>Allowed roles</th><th>Expiry</th></tr></thead><tbody>{grants.map(g=><tr key={g.feature_key}><td>{paidCapabilities.find(f=>f.key===g.feature_key)?.name||g.feature_key}</td><td>{!g.enabled?'Inactive':g.expires_at&&new Date(g.expires_at)<new Date()?'Expired':'Enabled'}</td><td>{g.allowed_roles.join(', ')}</td><td>{g.expires_at?new Date(g.expires_at).toLocaleDateString('en-NG'):'No expiry'}</td></tr>)}</tbody></table></div>{!grants.length&&<p className="muted">No extra modules granted.</p>}<FeatureGrantForm businessId={id} current={grants}/></>}
   {!auditResult.error&&!!auditResult.data?.length&&<details><summary>Recent access changes</summary>{auditResult.data.map(a=><p key={a.id} className="small muted">{a.feature_key} · {new Date(a.changed_at).toLocaleString('en-NG')}</p>)}</details>}
  </section>
  {!!b.review_history?.length&&<section className="card card-pad" style={{marginTop:20}}><h2>Review history</h2>{b.review_history.map((h,i)=><p key={i} className="small muted">{h.status} · {new Date(h.changed_at).toLocaleString('en-NG')}</p>)}</section>}
 </main>;
}
