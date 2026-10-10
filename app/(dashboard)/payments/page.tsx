import Link from 'next/link';
import {getWorkspace} from '@/lib/server/workspace';
import {money} from '@/lib/format';
export const dynamic='force-dynamic';
export default async function Payments(){
 const {client,businessId}=await getWorkspace();
 const [paymentsResult,ordersResult]=await Promise.all([
 client.from('payments').select('id,order_id,amount,method,status,reference,paid_at').eq('business_id',businessId).order('paid_at',{ascending:false}).limit(200),
 client.from('orders').select('id,order_number,total,status,payments(amount,status)').eq('business_id',businessId).limit(200)
 ]);
 if(paymentsResult.error||ordersResult.error)throw new Error('Unable to load your payment records. Check database permissions and migrations.');
 const payments=paymentsResult.data||[],orders=ordersResult.data||[];
 const names=new Map(orders.map(o=>[o.id,o.order_number]));
 const received=payments.filter(p=>p.status==='completed').reduce((v,p)=>v+Number(p.amount),0);
 const outstanding=orders.filter(o=>o.status!=='cancelled').reduce((v,o)=>v+Math.max(0,Number(o.total)-(o.payments||[]).filter(p=>p.status==='completed').reduce((a,p)=>a+Number(p.amount),0)),0);
 return <div className="tax-page"><p className="small muted">BUSINESS / FINANCE</p><h1>Customer payments</h1><p className="muted">Real payments recorded in your workspace. Only completed payments count as received.</p>
 <div className="grid grid-2"><section className="tax-panel"><p className="small muted">Received in latest {payments.length} payment records</p><h2>{money(received)}</h2></section><section className="tax-panel"><p className="small muted">Outstanding across latest {orders.length} orders</p><h2>{money(outstanding)}</h2></section></div>
 <section className="tax-panel"><h2>Payment history</h2><p className="small muted">To record a payment, open its order and select Record Payment. No payment gateway is connected.</p><div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Order</th><th>Amount</th><th>Method</th><th>Status</th><th>Reference</th><th>Document</th></tr></thead><tbody>{payments.map(p=><tr key={p.id}><td>{new Date(p.paid_at).toLocaleDateString('en-NG')}</td><td><Link href={`/orders/${p.order_id}`}>{names.get(p.order_id)||'View order'}</Link></td><td>{money(Number(p.amount))}</td><td>{p.method}</td><td>{p.status}</td><td>{p.reference||'—'}</td><td>{p.status==='completed'?<Link href={`/payments/${p.id}`}>Print acknowledgement</Link>:'—'}</td></tr>)}</tbody></table></div>{!payments.length&&<p className="muted">No payments recorded yet. Create an order and record its first payment.</p>}{(payments.length===200||orders.length===200)&&<p className="muted small">Latest 200 records displayed; use paginated financial reports for complete totals.</p>}</section></div>;
}
