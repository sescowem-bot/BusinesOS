import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {ReminderForm} from './reminder-form';
export const dynamic='force-dynamic';
type Renewal={business_id:string;business_name:string;plan_id:string;period_ends:string;owner_user_id:string};
export default async function Renewals(){
 const admin=await requirePlatformAdmin();
 if(!admin)return <main className="admin-area"><h1>Administrator access required</h1><Link href="/login">Sign in</Link></main>;
 const {data,error}=await admin.client.rpc('admin_subscription_due_list');
 const entries=(data||[]) as Renewal[];
 const canEmail=process.env.ENABLE_PLATFORM_EMAIL_DELIVERY==='true'&&!!process.env.RESEND_API_KEY&&!!process.env.RESEND_FROM_EMAIL;
 const overdue=entries.filter(r=>new Date(r.period_ends).getTime()<Date.now());
 return <main className="admin-area"><div className="admin-header"><div><span className="badge badge-brand">SYSTEM OWNER / BILLING</span><h1>Subscriptions & renewals</h1><p>Review paid subscriptions approaching renewal and contact the account owner. Customer sales balances are managed inside each business, not here.</p></div><Link href="/admin/plans" className="btn">Manage plan prices</Link></div>
 <div className="grid grid-3" style={{margin:'18px 0'}}><section className="card card-pad"><p className="small muted">Subscriptions to review</p><h2>{error?'—':entries.length}</h2></section><section className="card card-pad"><p className="small muted">Past renewal date</p><h2>{error?'—':overdue.length}</h2></section><section className="card card-pad"><p className="small muted">Email reminders</p><h2>{canEmail?'Enabled':'Setup needed'}</h2></section></div>
 <section className="card card-pad"><h2>Renewal dates</h2><p className="small muted">Shows paid plans ending within 30 days, including the preceding 30 days. This is not a list of confirmed debts: a subscription is normally prepaid. An email only sends when you choose to send one.</p>
 {error?<p role="alert">Renewal information is unavailable. Check SQL 050 in System diagnostics.</p>:entries.length===0?<p>No subscriptions require renewal review in this period.</p>:<div className="table-wrap"><table className="table"><thead><tr><th>Business</th><th>Plan</th><th>Period ends</th><th>State</th><th>Next step</th></tr></thead><tbody>{entries.map(r=><tr key={`${r.business_id}-${r.owner_user_id}`}><td><Link href={`/admin/businesses/${r.business_id}`}>{r.business_name}</Link></td><td>{r.plan_id}</td><td>{new Date(r.period_ends).toLocaleDateString('en-NG')}</td><td>{new Date(r.period_ends).getTime()<Date.now()?'Renewal date passed':'Renewal approaching'}</td><td>{canEmail?<ReminderForm businessId={r.business_id} expiry={r.period_ends}/>:<Link href="/admin/email">Configure sender</Link>}</td></tr>)}</tbody></table></div>}
 </section><p className="small muted">An actual unpaid invoice must be recorded separately. Changing a company's plan manually does not collect a payment.</p></main>;
}
