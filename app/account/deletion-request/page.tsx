import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getServerSupabase} from '@/lib/server/supabase';
import {ClosureRequestForm} from './request-form';
export const dynamic='force-dynamic';
type RequestRow={id:string;request_type:string;status:string;review_note:string;created_at:string};
export default async function ClosureRequestPage(){
 const client=await getServerSupabase();
 if(!client)redirect('/login');
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||!user)redirect('/login');
 const [memberships,requests]=await Promise.all([
  client.from('business_members').select('business_id,businesses(name)').eq('user_id',user.id).eq('role','owner').limit(80),
  client.rpc('my_platform_deletion_requests')
 ]);
 const businesses=(memberships.data||[]).map(m=>({
   business_id:m.business_id,
   name:(m.businesses as unknown as {name?:string}|null)?.name||'My business'
 }));
 const rows=(requests.data||[]) as RequestRow[];
 return <main className="bo-page" style={{maxWidth:1050,margin:'32px auto',padding:'0 20px 48px'}}>
  <div className="page-head"><div><p className="small muted">ACCOUNT &amp; PRIVACY</p>
   <h1>Account &amp; business closure requests</h1>
   <p>Send a request and follow its progress. Nothing is automatically erased.</p></div>
   <Link href="/privacy" className="btn">Privacy notice</Link></div>
  <div className="grid grid-2">
   <section className="card card-pad"><h2>Submit a request</h2>
    {memberships.error&&<p role="alert">Business ownership could not be checked. You can still request review of your personal account.</p>}
    <ClosureRequestForm businesses={memberships.error?[]:businesses}/></section>
   <section className="card card-pad"><h2>What happens next?</h2>
    <p>We verify identity, check subscriptions, determine whether records must be retained and consider a secure export.</p>
    <p>Approval for processing does not mean deletion is completed. We will not automatically erase accounting or business records.</p>
    <p><Link href="/settings/privacy">Your privacy settings</Link></p>
   </section>
  </div>
  <section className="card card-pad" style={{marginTop:20}}><h2>Your requests</h2>
   {requests.error?<p role="alert">Request history is temporarily unavailable. Contact support if this continues.</p>:
   rows.length===0?<p>No requests submitted yet.</p>:
   <div className="table-wrap"><table className="table"><thead><tr><th>Submitted</th><th>Type</th><th>Status</th><th>Response</th></tr></thead>
   <tbody>{rows.map(r=><tr key={r.id}>
    <td>{new Date(r.created_at).toLocaleDateString('en-NG')}</td>
    <td>{r.request_type==='business_closure'?'Business closure':'Personal account erasure'}</td>
    <td>{r.status.replaceAll('_',' ')}</td>
    <td>{r.review_note||'Awaiting review'}</td>
   </tr>)}</tbody></table></div>}
  </section>
 </main>;
}
