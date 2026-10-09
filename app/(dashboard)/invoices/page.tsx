import Link from 'next/link';
import {getWorkspace} from '@/lib/server/workspace';
import {money} from '@/lib/format';
export const dynamic='force-dynamic';
export default async function Invoices(){
 const {client,businessId}=await getWorkspace();
 const [result,links]=await Promise.all([
  client.from('orders').select('id,order_number,total,status,created_at,customer_id,payments(amount,status)').eq('business_id',businessId).order('created_at',{ascending:false}).limit(200),
  client.from('business_customers').select('customer_id,customers(name)').eq('business_id',businessId)
 ]);
 if(result.error||links.error)throw new Error('Unable to load invoice source records. Check permissions and migrations.');
 const names=new Map((links.data||[]).map((v:any)=>[v.customer_id,Array.isArray(v.customers)?v.customers[0]?.name:v.customers?.name]));
 return <div className="tax-page"><p className="small muted">BUSINESS / DOCUMENTS</p><h1>Invoices & receipts</h1><p className="muted">Live order balances. Standalone numbered invoice generation and printable receipt issuance are not yet enabled.</p><p><Link className="btn primary" href="/orders/new">Create order</Link></p><section className="tax-panel"><div className="table-wrap"><table className="table"><thead><tr><th>Order reference</th><th>Customer</th><th>Order total</th><th>Received</th><th>Outstanding</th><th>Date</th><th>View</th></tr></thead><tbody>{(result.data||[]).map(o=>{const paid=(o.payments||[]).filter(x=>x.status==='completed').reduce((s,x)=>s+Number(x.amount),0);return <tr key={o.id}><td>{o.order_number}</td><td>{names.get(o.customer_id)||'Walk-in'}</td><td>{money(Number(o.total))}</td><td>{money(paid)}</td><td>{money(Math.max(0,Number(o.total)-paid))}</td><td>{new Date(o.created_at).toLocaleDateString('en-NG')}</td><td><Link href={`/orders/${o.id}`}>View order</Link></td></tr>})}</tbody></table></div>{!result.data?.length&&<p className="muted">No orders yet. Create an order to begin building invoice-ready records.</p>}{result.data?.length===200&&<p className="muted small">Latest 200 orders shown, not a full ledger export.</p>}</section></div>;
}
