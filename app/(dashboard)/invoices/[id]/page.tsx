import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getWorkspace} from '@/lib/server/workspace';
import {money} from '@/lib/format';
import {PrintDocumentButton} from '@/components/print-document-button';
export const dynamic='force-dynamic';
export default async function OrderStatement({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 const {client,businessId}=await getWorkspace();
 const [orderResult,businessResult]=await Promise.all([
  client.from('orders').select('id,customer_id,order_number,status,subtotal,discount,tax,delivery_fee,total,due_date,created_at,order_items(name_snapshot,quantity,unit_price,line_total),payments(id,amount,status,paid_at)').eq('id',id).eq('business_id',businessId).maybeSingle(),
  client.from('businesses').select('name,address,phone,email,currency').eq('id',businessId).maybeSingle()
 ]);
 if(orderResult.error||businessResult.error)throw new Error('Order statement could not be loaded.');
 const order=orderResult.data,business=businessResult.data;
 if(!order||!business)notFound();
 const {data:customer,error:customerError}=order.customer_id?await client.from('customers').select('name,phone,email,address').eq('id',order.customer_id).maybeSingle():{data:null,error:null};
 if(customerError)throw new Error('Customer information could not be loaded.');
 const payments=order.payments||[];
 const paid=payments.filter(p=>p.status==='completed').reduce((a,p)=>a+Number(p.amount),0);
 const due=Math.max(0,Number(order.total)-paid);
 return <article className="business-document"><div className="document-actions print-hidden"><Link href={`/orders/${id}`}>← Back to order</Link><PrintDocumentButton/></div>
  <header className="document-header"><div><h1>{business.name}</h1><p>{business.address||'Business address not provided'}</p><p>{[business.phone,business.email].filter(Boolean).join(' • ')}</p></div><div><h2>Order Statement</h2><strong>{order.order_number}</strong><p>{new Date(order.created_at).toLocaleDateString('en-NG')}</p></div></header>
  <p className="document-disclaimer">Order statement and payment summary only. This is not a numbered tax invoice or statutory receipt.</p>
  <section className="document-section"><h3>Customer</h3><strong>{customer?.name||'Walk-in customer'}</strong>{customer?.email&&<p>{customer.email}</p>}{customer?.address&&<p>{customer.address}</p>}<p>Order status: {order.status}</p>{order.due_date&&<p>Due date: {order.due_date}</p>}</section>
  <table className="document-table"><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{(order.order_items||[]).map((item,i)=><tr key={i}><td>{item.name_snapshot}</td><td>{item.quantity}</td><td>{money(Number(item.unit_price))}</td><td>{money(Number(item.line_total))}</td></tr>)}</tbody></table>
  <div className="document-totals"><p><span>Subtotal</span><strong>{money(Number(order.subtotal))}</strong></p><p><span>Discount</span><strong>{money(Number(order.discount))}</strong></p><p><span>Delivery</span><strong>{money(Number(order.delivery_fee))}</strong></p><p><span>Tax recorded</span><strong>{money(Number(order.tax))}</strong></p><p><span>Order total</span><strong>{money(Number(order.total))}</strong></p><p><span>Payments received</span><strong>{money(paid)}</strong></p><p className="document-balance"><span>Balance outstanding</span><strong>{money(due)}</strong></p></div>
  <section className="document-section"><h3>Payment history</h3>{!payments.length?<p>No completed payments recorded.</p>:<table className="document-table"><thead><tr><th>Date</th><th>Status</th><th>Amount</th><th>Document</th></tr></thead><tbody>{payments.map(p=><tr key={p.id}><td>{new Date(p.paid_at).toLocaleDateString('en-NG')}</td><td>{p.status}</td><td>{money(Number(p.amount))}</td><td>{p.status==='completed'?<Link href={`/payments/${p.id}`}>Acknowledgement</Link>:'—'}</td></tr>)}</tbody></table>}</section>
  <footer className="document-footer">Generated from saved BusinessOS order and payment records. Values reflect the records available at printing time.</footer>
 </article>;
}
