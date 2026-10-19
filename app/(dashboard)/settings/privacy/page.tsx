import Link from 'next/link';
import {getWorkspace} from '@/lib/server/workspace';
import {PrivacyRightsForm} from './request-form';
import {CookieSettingsButton} from '@/components/cookie-preferences';
export const dynamic='force-dynamic';
type RequestRow={id:string;kind:string;details:string;status:string;admin_response:string|null;created_at:string};
export default async function PrivacySettings(){
 const {client,role,userId}=await getWorkspace();
 const {data,error}=await client.from('privacy_rights_requests')
  .select('id,kind,details,status,admin_response,created_at')
  .eq('requested_by',userId).order('created_at',{ascending:false}).limit(40);
 const requests=(data||[]) as RequestRow[];
 return <main className="bo-page">
  <div className="page-head"><div><p className="small muted">BUSINESSOS / PRIVACY</p><h1>Privacy &amp; data rights</h1><p>Contact our privacy team, ask about your personal information and track requests securely.</p></div><Link className="btn" href="/settings">Back to settings</Link></div>
  <div className="grid grid-2">
   <section className="card card-pad"><h2>Submit a privacy request</h2><PrivacyRightsForm owner={role==='owner'}/></section>
   <section className="card card-pad"><h2>Your information</h2>
    <p>Your sign-in information and business records can have different data controllers. We review each request according to its scope and the law.</p>
    <p>Account closure and data deletion are subject to identity checks, applicable legal record-keeping and backup schedules. No deletion occurs simply because you submit this form.</p>
    <p><CookieSettingsButton className="bo-privacy-open-cookies"/></p><p className="small muted">See <Link href="/privacy">Privacy Notice</Link>, <Link href="/terms">Terms</Link> and <Link href="/cookies">Cookie Notice</Link>. Check if each document has received final approval before relying on it.</p>
    <p className="small muted">Do not send sensitive personal or payment details in your request text.</p>
   </section>
  </div>
  <section className="card card-pad" style={{marginTop:20}}><h2>My requests</h2>
   {error?<p role="alert">Request history is unavailable. Please ensure migration 051 is installed.</p>:
   requests.length===0?<p className="muted">You have no submitted privacy requests.</p>:
   <div className="table-wrap"><table className="table"><thead><tr><th>Submitted</th><th>Request</th><th>Status</th><th>Response</th></tr></thead><tbody>
    {requests.map(r=><tr key={r.id}><td>{new Date(r.created_at).toLocaleDateString('en-NG')}</td><td><strong>{r.kind.replace(/_/g,' ')}</strong><p className="small muted">{r.details}</p></td><td>{r.status.replace(/_/g,' ')}</td><td>{r.admin_response||'Awaiting secure review'}</td></tr>)}
   </tbody></table></div>}
  </section>
 </main>;
}
