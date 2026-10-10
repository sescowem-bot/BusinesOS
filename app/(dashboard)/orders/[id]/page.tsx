import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getWorkspace} from '@/lib/server/workspace';
import {PaymentForm} from '../../sales/forms';
import {IssueInvoiceForm} from '../../invoices/issue-form';
import {money} from '@/lib/format';
export default async function OrderDetail({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 const {client,businessId,role}=await getWorkspace();
 const [orderResult,invoiceResult]=await Promise.all([
  client.from('orders').select('id,order_number,status,subtotal,discount,tax,delivery_fee,total,due_date,order_items(name_snapshot,quantity,unit_price,line_total),payments(id,amount,method,status,paid_at)').eq('id',id).eq('business_id',businessId).maybeSingle(),
  client.from('business_invoices').select('id,invoice_number').eq('business_id',businessId).eq('order_id',id).maybeSingle()
 ]);
 if(orderResult.error||!orderResult.data)notFound();
 const order=orderResult.data,pays=Array.isArray(order.payments)?order.payments:[];
 const paid=pays.filter(p=>p.status==='completed').reduce((a,p)=>a+Number(p.amount),0);
 const balance=Math.max(0,Number(order.total)-paid);
 return <div className="tax-page">
  <p className="muted small">ORDERS / DETAILS</p><h1>{order.order_number}</h1>
  <p><Link className="btn" href={`/invoices/${id}`}>Print order statement</Link></p>
  <p>Status: {order.status} · Due: {order.due_date||'Not set'}</p>
  <section className="tax-panel"><h2>Order items</h2>{(order.order_items||[]).map((x:any,i:number)=><div key={i} className="tax-list-row"><span>{x.name_snapshot} · {x.quantity} × {money(Number(x.unit_price))}</span><strong>{money(Number(x.line_total))}</strong></div>)}
   <p>Subtotal: {money(Number(order.subtotal))}</p><p>Discount: {money(Number(order.discount))}</p><p>Delivery: {money(Number(order.delivery_fee))}</p><p>Tax recorded: {money(Number(order.tax))}</p><h3>Order total: {money(Number(order.total))}</h3></section>
  <section className="tax-panel"><h2>Commercial invoice</h2>
   {invoiceResult.error?<p role="alert" className="muted">Invoice issuing is unavailable. Check migration 022 and database permissions.</p>:
    invoiceResult.data?<p>Issued invoice <Link href={`/invoices/issued/${invoiceResult.data.id}`}>{invoiceResult.data.invoice_number} — View or print</Link></p>:
    !['owner','manager','finance','sales'].includes(role)?<p className="muted">Your role cannot issue invoices.</p>:
    order.status==='cancelled'?<p className="muted">Cancelled orders cannot be invoiced.</p>:
    <IssueInvoiceForm orderId={order.id}/>}
  </section>
  <section className="tax-panel"><h2>Payment history</h2>{pays.length?pays.map(p=><div key={p.id} className="tax-list-row"><span>{new Date(p.paid_at).toLocaleDateString('en-NG')} · {p.method} · {p.status}</span><strong>{money(Number(p.amount))}</strong>{p.status==='completed'&&<Link href={`/payments/${p.id}`}>Print acknowledgement</Link>}</div>):<p className="muted">No payments recorded.</p>}
   <p>Received: {money(paid)}</p><h3>Balance due: {money(balance)}</h3>{balance>0&&<PaymentForm order={order.id} balance={balance}/>}</section>
 </div>;
}
