import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {ClosureReviewForm} from './review-form';
export const dynamic='force-dynamic';
type RecordRow={id:string;request_type:string;subject_business_id:string|null;requested_by:string|null;reason:string;status:string;
 review_note:string;created_at:string;identity_verified:boolean;retention_reviewed:boolean;payment_reviewed:boolean;export_considered:boolean};
export default async function DeletionRequests(){
 const session=await requirePlatformAdmin();
 if(!session)return null;
 const {data,error}=await session.client.rpc('platform_deletion_review_queue');
 const rows=(data||[]) as RecordRow[];
 return <main className="admin-area">
  <header className="admin-header"><div>
   <span className="badge badge-brand">SYSTEM OWNER / PRIVACY</span>
   <h1>Account and business closure</h1>
   <p>Review verified requests. Approving a request never automatically deletes business data.</p>
  </div><Link href="/admin/privacy" className="btn">Privacy centre</Link></header>
  {error&&<section className="card card-pad" role="alert">
   <h2>Request queue unavailable</h2><p>Confirm the deletion-request RPC permissions and contact support. Do not rerun SQL 062.</p>
  </section>}
  {!error&&<section className="card card-pad"><h2>Requests awaiting review</h2>
   {rows.length===0&&<p>No account-closure or deletion requests yet.</p>}
   <div style={{display:'grid',gap:16}}>
   {rows.map(row=><article className="card card-pad" key={row.id}>
    <h3>{row.request_type==='business_closure'?'Business closure':'Personal account erasure'}</h3>
    <p className="small muted">{row.status.replaceAll('_',' ')} · Requested {new Date(row.created_at).toLocaleString('en-NG')}</p>
    <p className="small muted">Requestor {row.requested_by?.slice(0,8)||'Unavailable'} · {row.subject_business_id?('Business '+row.subject_business_id.slice(0,8)):'Personal account'}</p>
    <p>{row.reason}</p>
    {['approved_for_processing','declined'].includes(row.status)?
      <p className="small muted">Decision: {row.review_note}</p>:
      <ClosureReviewForm requestId={row.id}/>}
   </article>)}
   </div>
  </section>}
  <section className="card card-pad" style={{marginTop:16}}>
   <h2>Permanent deletion safeguard</h2>
   <p>Permanent deletion requires a separate authorised process covering identity, payment reconciliation, lawful retention, shared memberships and backups. This review queue makes no destructive calls.</p>
  </section>
 </main>;
}
