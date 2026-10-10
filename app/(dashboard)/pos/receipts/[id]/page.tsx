import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getWorkspace} from '@/lib/server/workspace';
import {PrintDocumentButton} from '@/components/print-document-button';
import {money} from '@/lib/format';
export const dynamic='force-dynamic';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function PosReceipt({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!UUID.test(id))notFound();
 const {client,businessId}=await getWorkspace();
 const [saleResult,orderResult,businessResult,identityResult]=await Promise.all([
  client.from('business_pos_sales').select('id,order_id,created_at,location_id,cashier_id').eq('business_id',businessId).eq('order_id',id).maybeSingle(),
  client.from('orders').select('id,order_number,created_at,customer_id,subtotal,discount,tax,delivery_fee,total,status,order_items(name_snapshot,quantity,unit_price,line_total),payments(id,method,amount,reference,paid_at,status)').eq('business_id',businessId).eq('id',id).maybeSingle(),
  client.from('businesses').select('name,address,phone,email,currency').eq('id',businessId).maybeSingle(),
  client.from('business_invoice_profiles').select('logo_url,display_name,footer_note').eq('business_id',businessId).maybeSingle()
 ]);
 if(saleResult.error||orderResult.error||businessResult.error)throw new Error('POS receipt could not be verified.');
 const sale=saleResult.data,order=orderResult.data,business=businessResult.data;
 if(!sale||!order||!business)notFound();
 const [customerResult,locationResult]=await Promise.all([
  order.customer_id?client.from('customers').select('name').eq('id',order.customer_id).maybeSingle():Promise.resolve({data:null,error:null}),
  sale.location_id?client.from('business_stock_locations').select('name').eq('id',sale.location_id).eq('business_id',businessId).maybeSingle():Promise.resolve({data:null,error:null})
 ]);
 if(customerResult.error||locationResult.error)throw new Error('POS receipt details could not be verified.');
 const identity=identityResult.error?null:identityResult.data;
 const logo=identity?.logo_url&&/^https:\/\//.test(identity.logo_url)?identity.logo_url:'';
 const payments=(order.payments||[]).filter(x=>x.status==='completed').sort((a,b)=>a.paid_at.localeCompare(b.paid_at));
 const received=payments.reduce((sum,p)=>sum+Number(p.amount),0);
 const outstanding=Math.max(0,Number(order.total)-received);
 return <article className="business-document bo-pos-receipt">
  <nav className="document-actions print-hidden" aria-label="Receipt actions"><Link href="/pos" className="btn">← Back to POS</Link><Link href={`/orders/${id}`} className="btn">Order details</Link><PrintDocumentButton/></nav>
  <header className="document-header"><div>{logo&&<img src={logo} alt="Business logo" width={56} height={56} style={{objectFit:"contain",marginBottom:12}}/>}<h1>{identity?.display_name||business.name}</h1><p>{business.address||'Business address not provided'}</p><p>{[business.phone,business.email].filter(Boolean).join(' • ')}</p></div><div><h2>POS Sale Summary</h2><strong>{order.order_number}</strong><p>{new Date(order.created_at).toLocaleString('en-NG',{dateStyle:'medium',timeStyle:'short'})}</p></div></header>
  <section className="document-section"><p><strong>Customer:</strong> {customerResult.data?.name||'Walk-in customer'}</p><p><strong>Stock location:</strong> {locationResult.data?.name||'Legacy / not assigned'}</p><p><strong>Sale reference:</strong> {order.order_number}</p></section>
  <table className="document-table"><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>
   {(order.order_items||[]).map((item,i)=><tr key={i}><td>{item.name_snapshot}</td><td>{item.quantity}</td><td>{money(Number(item.unit_price))}</td><td>{money(Number(item.line_total))}</td></tr>)}
  </tbody></table>
  <div className="document-totals"><p><span>Subtotal</span><strong>{money(Number(order.subtotal))}</strong></p>
   {Number(order.discount)>0&&<p><span>Discount</span><strong>− {money(Number(order.discount))}</strong></p>}
   <p><span>Tax recorded</span><strong>{money(Number(order.tax))}</strong></p>
   <p className="document-balance"><span>Total sale</span><strong>{money(Number(order.total))}</strong></p>
   <p><span>Verified-by-staff payments recorded</span><strong>{money(received)}</strong></p>
   <p className="document-balance"><span>Outstanding balance</span><strong>{money(outstanding)}</strong></p>
  </div>
  <section className="document-section"><h3>Recorded payment methods</h3>
   {payments.length?<table className="document-table"><thead><tr><th>Method</th><th>Amount</th><th>Reference</th><th>When</th></tr></thead><tbody>{payments.map(p=><tr key={p.id}><td>{p.method}</td><td>{money(Number(p.amount))}</td><td>{p.reference||'—'}</td><td>{new Date(p.paid_at).toLocaleString('en-NG')}</td></tr>)}</tbody></table>:<p>No confirmed payment is recorded for this sale.</p>}
  </section>
  <footer className="document-footer">{identity?.footer_note&&<p>{identity.footer_note}</p>}<p>Thank you for your business.</p><p>This POS summary records a sale and payment entries confirmed by staff. It does not verify bank/card settlement, constitute an NRS-validated electronic invoice or replace a separately issued commercial invoice. For assessed VAT classifications, consult the issued invoice and original transaction.</p></footer>
 </article>;
}
