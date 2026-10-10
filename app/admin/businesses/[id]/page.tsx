import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {BusinessReviewForm} from './review-form';
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
 return <main className="admin-area">
  <header className="admin-header"><div><Link href="/admin/businesses">← Business directory</Link><span className="badge badge-brand">PLATFORM ADMIN / BUSINESS</span><h1>{b.name}</h1><p>{b.slug} · {b.category} · Created {new Date(b.created_at).toLocaleDateString('en-NG')}</p></div><Link href="/admin/upgrades" className="btn">Review upgrades</Link></header>
  <div className="grid grid-3"><section className="card card-pad"><p className="small muted">Members</p><h2>{b.members.length}</h2></section><section className="card card-pad"><p className="small muted">Approved plan</p><h2>{b.plan_id||'Unassigned'}</h2></section><section className="card card-pad"><p className="small muted">Pending upgrades</p><h2>{b.pending_upgrades}</h2></section></div>
  <div className="grid grid-2" style={{marginTop:20}}>
   <section className="card card-pad"><h2>Workspace information</h2><p><strong>Email:</strong> {b.email||'Not provided'}</p><p><strong>Phone:</strong> {b.phone||'Not provided'}</p><p><strong>Location:</strong> {[b.city,b.state,b.country].filter(Boolean).join(', ')||'Not provided'}</p><p><strong>Publicly listed:</strong> {b.published?'Yes':'No'}</p><p><strong>Verified flag:</strong> {b.verified?'Yes':'No'}</p><p className="muted small">These values are read-only here. Account suspension, impersonation and irreversible deletion are not available.</p></section>
   <section className="card card-pad"><BusinessReviewForm businessId={b.id} status={b.review?.status||'open'} note={b.review?.note||''}/></section>
  </div>
  <section className="card card-pad" style={{marginTop:20}}><h2>Business team</h2><div style={{overflowX:'auto'}}><table style={{width:'100%'}}><thead><tr><th align="left">Member</th><th align="left">Role</th><th align="left">Joined</th></tr></thead><tbody>{b.members.map(m=><tr key={m.user_id}><td style={{padding:'10px 6px'}}>{m.full_name?.trim()||'Name not provided'}<div className="small muted">{m.user_id}</div></td><td>{m.role}</td><td>{new Date(m.joined_at).toLocaleDateString('en-NG')}</td></tr>)}</tbody></table></div>{!b.members.length&&<p>No members found.</p>}</section>
  {!!b.review_history?.length&&<section className="card card-pad" style={{marginTop:20}}><h2>Review history</h2>{b.review_history.map((h,i)=><p key={i} className="small muted">{h.status} · {new Date(h.changed_at).toLocaleString('en-NG')}</p>)}</section>}
 </main>;
}
