import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getWorkspace} from '@/lib/server/workspace';
import {PrintDocumentButton} from '@/components/print-document-button';
export const dynamic='force-dynamic';

type InvoiceSnapshot={
 seller?:{name?:string;address?:string;phone?:string;email?:string;currency?:string};
 customer?:{name?:string;address?:string;phone?:string;email?:string};
 items?:Array<{description:string;quantity:number;unit_price:number;line_total:number}>;
 order_number?:string;order_due_date?:string|null;
 subtotal?:number;discount?:number;delivery_fee?:number;tax_recorded?:number;total?:number;paid_at_issue?:number;
};
export default async function IssuedInvoice({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 const {client,businessId}=await getWorkspace();
 const {data:invoice,error}=await client.from('business_invoices')
  .select('id,invoice_number,issued_at,order_id,snapshot').eq('business_id',businessId).eq('id',id).maybeSingle();
 if(error)throw new Error('Issued invoice unavailable. Confirm migration 022 is installed.');
 if(!invoice)notFound();
 const s=(invoice.snapshot||{}) as InvoiceSnapshot, seller=s.seller||{},customer=s.customer||{},items=Array.isArray(s.items)?s.items:[];
 const currency=typeof seller.currency==='string'&&/^[A-Z]{3}$/.test(seller.currency)?seller.currency:'NGN';
 const amount=(value:unknown)=>{const n=Number(value);return new Intl.NumberFormat('en-NG',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(Number.isFinite(n)?n:0)};
 return <article className="business-document">
  <div className="document-actions print-hidden"><Link href="/invoices">← Back to invoices</Link><PrintDocumentButton/></div>
  <header className="document-header"><div><h1>{seller.name||'Business'}</h1><p>{seller.address||''}</p><p>{[seller.phone,seller.email].filter(Boolean).join(' • ')}</p></div><div><h2>Commercial Invoice</h2><strong>{invoice.invoice_number}</strong><p>Issued {new Date(invoice.issued_at).toLocaleDateString('en-NG')}</p></div></header>
  <p className="document-disclaimer">Commercial invoice issued from BusinessOS records. This document is not certified as a Nigerian statutory tax or e-invoice. Tax amounts are reproduced from the saved order, not recalculated.</p>
  <section className="document-section"><h3>Bill to</h3><strong>{customer.name||'Walk-in customer'}</strong>{customer.address&&<p>{customer.address}</p>}{customer.email&&<p>{customer.email}</p>}
   <p>Order: {s.order_number||'—'}</p>{s.order_due_date&&<p>Due date: {String(s.order_due_date)}</p>}</section>
  <table className="document-table"><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>
   {items.map((item,i)=><tr key={i}><td>{item.description}</td><td>{item.quantity}</td><td>{amount(Number(item.unit_price))}</td><td>{amount(Number(item.line_total))}</td></tr>)}
  </tbody></table>
  <div className="document-totals">
   <p><span>Subtotal</span><strong>{amount(Number(s.subtotal||0))}</strong></p>
   <p><span>Discount</span><strong>{amount(Number(s.discount||0))}</strong></p>
   <p><span>Delivery</span><strong>{amount(Number(s.delivery_fee||0))}</strong></p>
   <p><span>Tax recorded</span><strong>{amount(Number(s.tax_recorded||0))}</strong></p>
   <p className="document-balance"><span>Total at issuance</span><strong>{amount(Number(s.total||0))}</strong></p>
   <p><span>Payments recorded at issuance</span><strong>{amount(Number(s.paid_at_issue||0))}</strong></p>
  </div>
  <footer className="document-footer">Invoice content is a saved snapshot captured on issuance. Subsequent payments may change the order balance but do not change this invoice.</footer>
 </article>;
}
