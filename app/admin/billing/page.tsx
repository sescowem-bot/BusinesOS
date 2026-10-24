import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {billingAdmin} from '@/lib/server/billing';
import {amountNGN,paymentStatus,validBusinessId,validPage,BILLING_PAGE_SIZE} from '@/lib/phase3/billing-ledger';
export const dynamic='force-dynamic';
type Search={business?:string;page?:string};
type Payment={id:string;business_id:string;plan_id:string;billing_cycle:string;status:string;amount_kobo:number|string;created_at:string;paid_at:string|null;paid_until:string|null};
const day=(v:string|null)=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('en-NG',{timeZone:'Africa/Lagos'}):'—';
export default async function BillingLedger({searchParams}:{searchParams:Promise<Search>}){
 const admin=await requirePlatformAdmin();
 if(!admin)return <main className="admin-area"><h1>System Owner access required</h1><Link href="/login">Sign in</Link></main>;
 const q=await searchParams;
 if(q.business&&!validBusinessId(q.business))return <main className="admin-area"><h1>Invalid company filter</h1><Link href="/admin/businesses">Business directory</Link></main>;
 const business=q.business||null,page=validPage(q.page),start=(page-1)*BILLING_PAGE_SIZE;
 let server:ReturnType<typeof billingAdmin>;
 try{server=billingAdmin()}catch{return <main className="admin-area"><h1>Billing history unavailable</h1><p>Protected billing access is not configured. No subscription was changed.</p><Link href="/admin/health">Open diagnostics</Link></main>}
 let query=server.from('business_subscription_payments')
  .select('id,business_id,plan_id,billing_cycle,status,amount_kobo,created_at,paid_at,paid_until',{count:'exact'})
  .order('created_at',{ascending:false}).order('id',{ascending:false}).range(start,start+BILLING_PAGE_SIZE-1);
 if(business)query=query.eq('business_id',business);
 const [result,audit]=await Promise.all([
  query,
  business?server.from('business_admin_plan_audit').select('id,previous_plan_id,new_plan_id,reason,changed_at').eq('business_id',business).order('changed_at',{ascending:false}).limit(15):Promise.resolve(null)
 ]);
 const rows=(result.data||[]) as Payment[],total=result.count??null,now=Date.now();
 const url=(n:number)=>'/admin/billing?'+(business?'business='+encodeURIComponent(business)+'&':'')+'page='+n;
 const hasNext=total===null?rows.length===BILLING_PAGE_SIZE:start+rows.length<total;
 return <main className="admin-area">
  <header className="admin-header"><div><span className="badge badge-brand">SYSTEM OWNER / BILLING</span><h1>Subscription payment ledger</h1><p>Read-only review of recorded checkout attempts. Never assume a pending record means Paystack did not collect payment.</p></div><div><Link className="btn" href="/admin/renewals">Renewals</Link> <Link className="btn" href="/admin/plans">Plan pricing</Link></div></header>
  <p className="small muted">This is a paginated operational register, not a bank settlement or revenue report. Verify disputed payments using the existing Paystack verification flow.</p>
  {business&&<section className="card card-pad"><strong>Business filter:</strong> <code>{business}</code> <Link className="btn" href="/admin/billing">Clear filter</Link></section>}
  <section className="card card-pad" style={{marginTop:16}}><h2>Payment records</h2>
   {result.error?<p role="alert">Billing records are unavailable. Check the protected service configuration and database permissions.</p>:
   !rows.length?<p>No payment records were found on this page.</p>:<div className="table-wrap"><table className="table"><thead><tr><th>Recorded</th><th>Business</th><th>Plan</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map(p=>{const status=paymentStatus(p,now);return <tr key={p.id}><td>{day(p.created_at)}</td><td><Link href={'/admin/businesses/'+p.business_id}>{p.business_id.slice(0,8)}…</Link></td><td>{p.plan_id} · {p.billing_cycle}</td><td>{amountNGN(p.amount_kobo)}</td><td>{status.alert?<strong>{status.label}</strong>:status.label}{p.status==='paid'&&<div className="small muted">Paid at {day(p.paid_at)}</div>}</td><td><Link href={'/admin/billing?business='+encodeURIComponent(p.business_id)}>History</Link></td></tr>})}</tbody></table></div>}
   {!result.error&&<nav aria-label="Billing pages" style={{display:'flex',alignItems:'center',gap:12,marginTop:16}}>
    <span>Page {page}{total!==null?' · '+total+' records':''}</span>
    {page>1&&<Link className="btn" href={url(page-1)}>Previous</Link>}
    {hasNext&&page<100&&<Link className="btn" href={url(page+1)}>Next</Link>}
   </nav>}
  </section>
  {business&&<section className="card card-pad" style={{marginTop:16}}><h2>Recent manual plan changes</h2><p className="small muted">Audit history is not proof of subscription payment.</p>
   {audit?.error?<p role="alert">Audit records could not be verified.</p>:!audit?.data?.length?<p>No manual changes in the returned history.</p>:<div className="table-wrap"><table className="table"><thead><tr><th>When</th><th>Previous</th><th>New</th><th>Reason</th></tr></thead><tbody>{audit.data.map(a=><tr key={a.id}><td>{day(a.changed_at)}</td><td>{a.previous_plan_id||'—'}</td><td>{a.new_plan_id}</td><td>{a.reason||'—'}</td></tr>)}</tbody></table></div>}
  </section>}
  <p className="small muted" style={{marginTop:20}}>Viewing this page does not send email, charge a customer, settle a transaction or change a plan.</p>
 </main>;
}
