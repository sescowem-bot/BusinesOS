import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getWorkspace} from '@/lib/server/workspace';
import {money} from '@/lib/format';
import {PrintDocumentButton} from '@/components/print-document-button';
export const dynamic='force-dynamic';
export default async function PaymentAcknowledgement({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 const {client,businessId}=await getWorkspace();
 const [{data:payment,error},{data:business,error:businessError}]=await Promise.all([
  client.from('payments').select('id,order_id,customer_id,amount,method,status,reference,paid_at').eq('id',id).eq('business_id',businessId).maybeSingle(),
  client.from('businesses').select('name,address,phone,email').eq('id',businessId).maybeSingle()
 ]);
 if(error||businessError)throw new Error('Payment acknowledgement could not be loaded.');
 if(!payment||payment.status!=='completed'||!business)notFound();
 const [{data:order,error:orderError},{data:customer,error:customerError}]=await Promise.all([
  client.from('orders').select('order_number,total').eq('business_id',businessId).eq('id',payment.order_id).maybeSingle(),
  payment.customer_id?client.from('customers').select('name').eq('id',payment.customer_id).maybeSingle():Promise.resolve({data:null,error:null})
 ]);
 if(orderError||customerError||!order)throw new Error('Associated order could not be loaded.');
 return <article className="business-document"><div className="document-actions print-hidden"><Link href={`/orders/${payment.order_id}`}>← Back to order</Link><PrintDocumentButton/></div>
  <header className="document-header"><div><h1>{business.name}</h1><p>{business.address||''}</p><p>{[business.phone,business.email].filter(Boolean).join(' • ')}</p></div><div><h2>Payment Acknowledgement</h2><p>{new Date(payment.paid_at).toLocaleString('en-NG')}</p></div></header>
  <p className="document-disclaimer">This acknowledges a manually recorded payment. It does not confirm settlement with a bank or payment gateway and is not a statutory tax receipt.</p>
  <section className="document-section"><h3>Payment details</h3><dl className="document-details"><dt>Customer</dt><dd>{customer?.name||'Walk-in customer'}</dd><dt>Order number</dt><dd>{order.order_number}</dd><dt>Payment reference</dt><dd>{payment.reference||'Not provided'}</dd><dt>Method</dt><dd>{payment.method}</dd><dt>Status</dt><dd>Recorded as completed</dd><dt>Amount</dt><dd><strong>{money(Number(payment.amount))}</strong></dd></dl></section>
  <footer className="document-footer">Generated from a saved BusinessOS payment record on {new Date().toLocaleDateString('en-NG')}. Verify independently with the receiving bank where necessary.</footer>
 </article>;
}
