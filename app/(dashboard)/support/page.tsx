import Link from 'next/link';
import {getWorkspace} from '@/lib/server/workspace';
import {BusinessPageHeading,BusinessAlert,BusinessSection} from '@/components/business-page-ui';
import {SupportForm} from './request-form';
export const dynamic='force-dynamic';
export default async function BusinessSupport(){
 const {client,businessId,role,userId}=await getWorkspace();
 const [tickets,members]=await Promise.all([
  client.from('business_support_requests').select('id,kind,subject,status,details,admin_response,created_at,requested_by').eq('business_id',businessId).order('created_at',{ascending:false}).limit(40),
  role==='owner'?client.from('business_members').select('user_id,role,profiles(full_name)').eq('business_id',businessId).limit(100):Promise.resolve({data:[],error:null})
 ]);
 const memberOptions=(members.data||[]).map(m=>({user_id:m.user_id,role:m.role,full_name:((m.profiles as unknown as {full_name:string|null})?.full_name)||''}));
 return <div className="bo-page"><BusinessPageHeading eyebrow="BUSINESSOS / CUSTOMER ASSISTANCE" title="Help, support & role assistance" description="Contact the platform team, track requests and ask for help managing business accounts." action={{href:'/team',label:'Team & roles'}}/>
 <BusinessAlert>BusinessOS support never needs your password, session token or Supabase credentials. Platform administrators cannot sign in as your staff through this workflow. Role assistance requires an explicit request from a business owner.</BusinessAlert>
 <div className="grid grid-2"><section className="card card-pad"><h2>Request assistance</h2><p className="small muted">Describe what is wrong or which verified team member needs a different role.</p><SupportForm isOwner={role==='owner'} members={memberOptions}/></section><section className="card card-pad"><h2>Common support actions</h2><div className="list-row"><Link href="/team">Invite a staff member</Link><span className="small muted">Owner</span></div><div className="list-row"><Link href="/admin" prefetch={false}>Platform admin console</Link><span className="small muted">Admins only</span></div><div className="list-row"><Link href="/upgrade">Plans and feature access</Link><span className="small muted">Owner</span></div><p className="small muted">A staff role is different from a business plan. Role access is also restricted by subscription and module permissions.</p></section></div>
 <BusinessSection title="Your support requests" description="Recent requests for this business. Members see their own tickets; owners can track their business requests.">{tickets.error?<BusinessAlert>Support history could not be loaded. Confirm SQL 042 before submitting requests.</BusinessAlert>:<div className="table-wrap"><table className="table"><thead><tr><th>Created</th><th>Request</th><th>Status</th><th>Platform response</th></tr></thead><tbody>{(tickets.data||[]).map(t=><tr key={t.id}><td>{new Date(t.created_at).toLocaleDateString('en-NG')}</td><td><strong>{t.subject}</strong><p className="small muted">{t.kind==='role_change'?'Role assistance':'General support'}</p></td><td>{t.status}</td><td>{t.admin_response||'Awaiting review'}</td></tr>)}</tbody></table></div>}{!tickets.data?.length&&!tickets.error&&<p className="muted">No requests yet. Create one using the form above.</p>}</BusinessSection>
 </div>;
}
