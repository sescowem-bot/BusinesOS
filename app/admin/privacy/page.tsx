import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {ReviewPrivacyForm} from './review-form';
export const dynamic='force-dynamic';
type RequestRow={id:string;requested_by:string;business_id:string|null;kind:string;details:string;status:string;admin_response:string|null;created_at:string};
export default async function ComplianceCentre(){
 const admin=await requirePlatformAdmin();
 if(!admin)return null;
 const [requestsResult,documentsResult]=await Promise.all([
  admin.client.from('privacy_rights_requests').select('id,requested_by,business_id,kind,details,status,admin_response,created_at').order('created_at',{ascending:false}).limit(80),
  admin.client.from('legal_document_versions').select('document_key,version_label,published,effective_at').eq('published',true).order('effective_at',{ascending:false})
 ]);
 const requests=(requestsResult.data||[]) as RequestRow[];
 const open=requests.filter(r=>!['completed','declined'].includes(r.status));
 return <main className="admin-area">
  <header className="admin-header"><div><span className="badge badge-brand">SYSTEM OWNER / DATA PROTECTION</span><h1>Privacy &amp; compliance requests</h1><p>Track individual privacy enquiries, document reviews and access-control decisions. This workspace is not a regulatory certification or an automatic deletion system.</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Link href="/admin/content" className="btn">Website legal pages</Link><Link href="/admin/deletion-requests" className="btn">Account closure queue</Link><Link href="/admin/privacy/legal" className="btn btn-primary">Legal approvals &amp; versions</Link></div></header>
  <div className="grid grid-3">
   <section className="card card-pad"><p className="metric-label">Awaiting action</p><h2>{requestsResult.error?'—':open.length}</h2></section>
   <section className="card card-pad"><p className="metric-label">Requests loaded</p><h2>{requestsResult.error?'—':requests.length}</h2><p className="small muted">Latest 80</p></section>
   <section className="card card-pad"><p className="metric-label">Approved legal versions</p><h2>{documentsResult.error?'—':(documentsResult.data||[]).length}</h2><p className="small muted">Published and approved in evidence register</p></section>
  </div>
  {documentsResult.error&&<section className="card card-pad" role="alert"><h2>Legal register unavailable</h2><p>Install the additive SQL 051 migration after SQL 050.</p></section>}
  {!documentsResult.error&&!(documentsResult.data||[]).length&&<section className="card card-pad" style={{marginTop:16}}><h2>Legal review still required</h2><p>No approved legal-document versions are registered. Keep draft Privacy, Terms and Cookie pages unpublished until the operator and adviser approve their content. Do not enter fictitious approvals.</p></section>}
  <section className="card card-pad" style={{marginTop:18}}><h2>Requests requiring attention</h2>
   {requestsResult.error?<p role="alert">Privacy queue unavailable. Confirm SQL 051 and administrator permissions.</p>:
    open.length===0?<p className="muted">No open privacy requests among the latest 80.</p>:
    <div style={{display:'grid',gap:16}}>
     {open.map(r=><article className="card card-pad" key={r.id}>
      <div className="admin-header"><div><span className="badge">{r.status.replace(/_/g,' ')}</span><h3>{r.kind.replace(/_/g,' ')}</h3><p className="small muted">Received {new Date(r.created_at).toLocaleString('en-NG')} · Requester {r.requested_by.slice(0,8)} · {r.business_id?'Merchant scope':'Account scope'}</p></div></div>
      <p>{r.details}</p><ReviewPrivacyForm id={r.id}/>
     </article>)}
    </div>}
  </section>
  <section className="card card-pad" style={{marginTop:18}}><h2>Governance reminder</h2><p>Verify identity before releasing data. Determine whether BusinessOS is acting as controller or processor. Record decisions, legal exceptions, evidence and applicable reporting deadlines outside the status form.</p><p className="small muted">The approved version register is intentionally writable only through a trusted database operation after legal review.</p></section>
 </main>;
}
