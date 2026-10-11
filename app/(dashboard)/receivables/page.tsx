import Link from 'next/link';
import {getWorkspace} from '@/lib/server/workspace';
import {money} from '@/lib/format';
import {InstalmentForm} from './plan-form';
import {BalanceReminderForm} from './reminder-form';
export const dynamic='force-dynamic';
type Row={id:string;order_number:string;total:number;status:string;due_date:string|null;payments:{amount:number;status:string}[]};
type Agreement={order_id:string;installment_count:number;first_due_on:string;frequency_days:number;note:string};
export default async function Receivables(){
 const {client,businessId,role}=await getWorkspace();
 const [orderResult,planResult]=await Promise.all([
  client.from('orders').select('id,order_number,total,status,due_date,payments(amount,status)').eq('business_id',businessId).order('created_at',{ascending:false}).limit(200),
  client.from('business_order_installment_plans').select('order_id,installment_count,first_due_on,frequency_days,note').eq('business_id',businessId).eq('active',true).limit(200)
 ]);
 const canManage=['owner','manager','finance','sales'].includes(role);
 const emailEnabled=process.env.ENABLE_PLATFORM_EMAIL_DELIVERY==='true'&&!!process.env.RESEND_API_KEY&&!!process.env.RESEND_FROM_EMAIL;
 if(!canManage)return <div className="bo-page"><h1>Customer balances</h1><p>Your business administrator can manage payment arrangements.</p><Link href="/dashboard">Back to dashboard</Link></div>;
 const all=(orderResult.data||[]) as Row[];
 const open=all.map(r=>({...r,paid:(r.payments||[]).filter(p=>p.status==='completed').reduce((s,p)=>s+Number(p.amount||0),0)}))
  .filter(r=>r.status!=='cancelled'&&Number(r.total)-r.paid>0);
 const agreements=new Map(((planResult.data||[]) as Agreement[]).map(r=>[r.order_id,r]));
 const total=open.reduce((s,r)=>s+Math.max(0,Number(r.total)-r.paid),0);
 return <div className="bo-page"><div className="page-head"><div><span className="small muted">SALES / CUSTOMER BALANCES</span><h1>Outstanding & instalments</h1><p>See what customers still need to pay, agree payment dates and record each payment against its order.</p></div><Link className="btn" href="/orders">All orders</Link></div>
 {orderResult.error?<section className="card card-pad" role="alert">Customer balances could not be checked. Please try again.</section>:<><div className="grid grid-3" style={{margin:'18px 0'}}><section className="card card-pad"><p className="small muted">Outstanding on listed orders</p><h2>{money(total)}</h2></section><section className="card card-pad"><p className="small muted">Open orders</p><h2>{open.length}</h2></section><section className="card card-pad"><p className="small muted">Instalment arrangements</p><h2>{[...agreements.keys()].filter(x=>open.some(r=>r.id===x)).length}</h2></section></div>
 {all.length===200&&<p role="status" className="small muted">Showing the latest 200 orders only. The balance above is not an all-time financial total.</p>}
 {planResult.error&&<p role="status" className="small muted">Instalment arrangements could not be loaded. Please try again later.</p>}
 <section className="card card-pad"><h2>Customer balances</h2><p className="small muted">An instalment arrangement records an agreed schedule; it does not charge the customer or mark any payment as received.</p>
 {open.length===0?<p>All displayed orders are settled. <Link href="/orders/new">Create an order</Link></p>:<div className="table-wrap"><table className="table"><thead><tr><th>Order</th><th>Total</th><th>Received</th><th>Still due</th><th>Due date</th><th>Arrangement / next step</th></tr></thead><tbody>{open.map(r=>{const a=agreements.get(r.id);return <tr key={r.id}><td><Link href={`/orders/${r.id}`}>{r.order_number}</Link></td><td>{money(Number(r.total))}</td><td>{money(r.paid)}</td><td><strong>{money(Math.max(0,Number(r.total)-r.paid))}</strong></td><td>{r.due_date||'Not set'}</td><td>{a?<p className="small">{a.installment_count} instalments from {a.first_due_on} · around {money(Math.max(0,Number(r.total)-r.paid)/a.installment_count)} each on the current balance</p>:null}{canManage&&!planResult.error?<><InstalmentForm order={r.id}/>{emailEnabled&&<BalanceReminderForm order={r.id}/>}</>:<Link href={`/orders/${r.id}#payment-history`}>View payments</Link>}</td></tr>})}</tbody></table></div>}
 </section></>}
 <p className="small muted" style={{marginTop:12}}>Payments must be verified before recording. When email reminders are enabled, you can notify a customer about an outstanding order. Instalment arrangements never record a payment automatically.</p></div>;
}
