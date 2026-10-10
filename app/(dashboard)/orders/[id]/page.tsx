import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getWorkspace} from '@/lib/server/workspace';
import {PaymentForm} from '../../sales/forms';
import {IssueInvoiceForm} from '../../invoices/issue-form';
import {money} from '@/lib/format';
import {BusinessPageHeading,BusinessSection,BusinessSummary,BusinessAlert} from '@/components/business-page-ui';
export const dynamic='force-dynamic';
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
 const paid=pays.filter(p=>p.status==='completed').reduce((sum,p)=>sum+(Number(p.amount)||0),0);
 const total=Number(order.total)||0,balance=Math.max(0,total-paid);
 const canManage=['owner','manager','finance','sales'].includes(role);
 const cancelled=order.status==='cancelled';
 return <div className="bo-page">
  <BusinessPageHeading eyebrow="SALES / ORDER DETAILS" title={order.order_number||'Order details'} description={`Status: ${order.status||'Unknown'}  ·  Due date: ${order.due_date||'Not specified'}`}/>
  <p className="bo-back-link"><Link href="/orders">← All orders</Link> · <Link href={`/invoices/${id}`}>Printable order statement ↗</Link></p>
  <BusinessSummary items={[{label:'Order total',value:money(total)},{label:'Completed payments',value:money(paid)},{label:'Balance due',value:money(balance),warning:!cancelled&&balance>0}]}/>
  {cancelled&&<BusinessAlert>This order is cancelled. Review any recorded payments separately; cancellation and refund processing are not automated.</BusinessAlert>}
  <BusinessSection title="Order items" description="Amounts from the saved order. Verify invoice details before issuing a commercial document.">
   <div className="bo-detail-list">{(order.order_items||[]).map((item,i)=><div className="bo-detail-row" key={`${item.name_snapshot}-${i}`}><span>{item.name_snapshot}<small>{item.quantity} × {money(Number(item.unit_price))}</small></span><strong>{money(Number(item.line_total))}</strong></div>)}
   <div className="bo-detail-row"><span>Subtotal</span><strong>{money(Number(order.subtotal))}</strong></div>
   <div className="bo-detail-row"><span>Discount</span><strong>{money(Number(order.discount))}</strong></div>
   <div className="bo-detail-row"><span>Delivery fee</span><strong>{money(Number(order.delivery_fee))}</strong></div>
   <div className="bo-detail-row"><span>Recorded tax</span><strong>{money(Number(order.tax))}</strong></div>
   <div className="bo-detail-row bo-detail-total"><span>Total</span><strong>{money(total)}</strong></div>
   </div>
  </BusinessSection>
  <BusinessSection title="Commercial invoice" description="A numbered invoice can be issued once and preserves the details recorded at issuance.">
   <div className="bo-detail-section-body">{invoiceResult.error?<p role="alert">Invoice information is unavailable. Check migration 022 and your database permissions.</p>:
    invoiceResult.data?<p>Invoice <Link href={`/invoices/issued/${invoiceResult.data.id}`}>{invoiceResult.data.invoice_number} — View or print</Link></p>:
    !canManage?<p className="muted">Your role is not authorised to issue invoices.</p>:
    cancelled?<p className="muted">Cancelled orders cannot be invoiced.</p>:<IssueInvoiceForm orderId={order.id}/>}</div>
  </BusinessSection>
  <BusinessSection title="Payment history" description="Only completed payment entries reduce the outstanding balance.">
   <div className="bo-detail-section-body">{pays.length?pays.map(p=><div key={p.id} className="bo-detail-row"><span>{new Date(p.paid_at).toLocaleDateString('en-NG')} · {p.method} · {p.status}</span><strong>{money(Number(p.amount))}</strong>{p.status==='completed'&&<Link href={`/payments/${p.id}`}>Print acknowledgement</Link>}</div>):<p className="muted">No payments recorded.</p>}
   {balance>0&&!cancelled&&canManage?<div className="bo-order-payment-form"><h3>Record a payment</h3><p className="muted small">Record only payments you have verified. This does not initiate a bank transfer.</p><PaymentForm order={order.id} balance={balance}/></div>:
    balance>0&&!cancelled&&!canManage?<p className="muted small">Only authorised sales or finance roles can record payments.</p>:null}</div>
  </BusinessSection>
 </div>;
}
