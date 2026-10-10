import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getWorkspace} from '@/lib/server/workspace';
import {PrintDocumentButton} from '@/components/print-document-button';
import {invoiceTaxLabel,invoiceTaxStatus,invoiceMoney, type InvoiceSnapshot} from '@/lib/invoice-document';
export const dynamic='force-dynamic';

export default async function IssuedInvoice({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 const {client,businessId}=await getWorkspace();
 const {data:invoice,error}=await client.from('business_invoices')
  .select('id,invoice_number,issued_at,order_id,snapshot').eq('business_id',businessId).eq('id',id).maybeSingle();
 if(error)throw new Error('Invoice details are unavailable. Confirm invoice migrations.');
 if(!invoice)notFound();
 const snap=(invoice.snapshot||{}) as InvoiceSnapshot;
 const seller=snap.seller||{},buyer=snap.customer||{},identity=snap.invoice_identity||{};
 const items=Array.isArray(snap.items)?snap.items:[];
 const money=(value:unknown)=>invoiceMoney(value,seller.currency);
 const total=Number(snap.total||0),paid=Number(snap.paid_at_issue||0),due=Math.max(0,total-paid);
 const tax=invoiceTaxStatus(snap);
 const issueDate=new Date(invoice.issued_at).toLocaleDateString('en-NG',{day:'2-digit',month:'short',year:'numeric'});
 const dueDate=snap.order_due_date?new Date(`${String(snap.order_due_date).slice(0,10)}T12:00:00Z`).toLocaleDateString('en-NG',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}):'';
 const logo=identity.logo_url&&/^https:\/\//.test(identity.logo_url)?identity.logo_url:'';
 return <div className="invoice-view">
  <nav className="invoice-view-actions print-hidden" aria-label="Invoice actions">
   <Link href="/invoices" className="btn">← All invoices</Link>
   <PrintDocumentButton/>
  </nav>
  <article className="invoice-sheet" aria-label={`Invoice ${invoice.invoice_number}`}>
   <div className="invoice-accent"/>
   <header className="invoice-head">
    <div className="invoice-seller">
     <div className="invoice-seller-main">
      {logo?<img className="invoice-logo" src={logo} alt="Business logo"/>:<span className="invoice-logo-fallback" aria-hidden="true">{(identity.display_name||seller.name||'B').slice(0,1).toUpperCase()}</span>}
      <div><h1>{identity.display_name||seller.name||'Business'}</h1><p className="invoice-muted">{seller.address||''}</p><p className="invoice-muted">{[seller.phone,seller.email].filter(Boolean).join('  •  ')}</p></div>
     </div>
     {(identity.registration_number||identity.tax_identification_number)&&<p className="invoice-business-ids">{identity.registration_number&&<span>RC / BN: {identity.registration_number}</span>}{identity.tax_identification_number&&<span>TIN: {identity.tax_identification_number}</span>}</p>}
    </div>
    <div className="invoice-number-block"><span className="invoice-eyebrow">INVOICE</span><strong>{invoice.invoice_number}</strong><span className="invoice-status-chip">Issued</span></div>
   </header>
   <div className="invoice-meta-grid">
    <section><span className="invoice-field-label">BILL TO</span><h2>{buyer.name||'Walk-in customer'}</h2>{buyer.address&&<p>{buyer.address}</p>}{buyer.email&&<p>{buyer.email}</p>}{buyer.phone&&<p>{buyer.phone}</p>}</section>
    <section className="invoice-meta-dates"><div><span className="invoice-field-label">ISSUE DATE</span><strong>{issueDate}</strong></div><div><span className="invoice-field-label">DUE DATE</span><strong>{dueDate||'As agreed'}</strong></div><div><span className="invoice-field-label">ORDER REFERENCE</span><strong>{snap.order_number||'—'}</strong></div></section>
   </div>
   <div className="invoice-items-wrap"><table className="invoice-items"><thead><tr><th scope="col">Description</th><th scope="col">Qty</th><th scope="col">Unit price</th><th scope="col">Amount</th></tr></thead><tbody>
    {items.map((item,i)=><tr key={i}><td data-heading="Item"><strong>{item.description||'Product or service'}</strong></td><td data-heading="Qty">{item.quantity}</td><td data-heading="Unit price">{money(item.unit_price)}</td><td data-heading="Amount">{money(item.line_total)}</td></tr>)}
   </tbody></table></div>
   <div className="invoice-settlement">
    <div className="invoice-help"><span className="invoice-field-label">PAYMENT DETAILS</span>{identity.bank_name?<><strong>{identity.bank_name}</strong><p>{identity.account_name}</p><p>{identity.account_number}</p></>:<p>Contact the business for payment instructions.</p>}
     <p className="invoice-tax-note">{tax.reviewed?`Tax recorded from an approved classification dated ${snap.tax_context?.tax_date||snap.pos_tax_lines?.[0]?.tax_date||'on the transaction date'}.`:'Tax classification was not verified in the saved invoice. Review before relying on this document for VAT compliance.'}</p>
    </div>
    <div className="invoice-amounts">
     <div><span>Subtotal</span><strong>{money(snap.subtotal)}</strong></div>
     {Number(snap.discount||0)>0&&<div><span>Discount</span><strong>− {money(snap.discount)}</strong></div>}
     {Number(snap.delivery_fee||0)>0&&<div><span>Delivery</span><strong>{money(snap.delivery_fee)}</strong></div>}
     <div><span>{invoiceTaxLabel(snap)}</span><strong>{money(snap.tax_recorded)}</strong></div>
     <div className="invoice-total"><span>Total due at issue</span><strong>{money(total)}</strong></div>
     <div><span>Payments at issue</span><strong>− {money(paid)}</strong></div>
     <div className="invoice-due"><span>Outstanding at issue</span><strong>{money(due)}</strong></div>
    </div>
   </div>
   {snap.pos_pricing_context&&<p className="invoice-pricing-note">POS catalogue prices were {snap.pos_pricing_context.price_mode==='inclusive'?'VAT-inclusive':'VAT-exclusive'} at checkout. The invoice displays their net values, with any pre-tax discount and assessed VAT shown separately.</p>}
   {tax.reviewed&&snap.pos_tax_lines?.length?<section className="invoice-pos-tax-summary" aria-label="VAT breakdown"><h3>VAT breakdown by item</h3><div className="table-wrap"><table className="invoice-items"><thead><tr><th>Item</th><th>VAT treatment</th><th>Taxable base</th><th>VAT</th></tr></thead><tbody>{snap.pos_tax_lines.map((line,i)=><tr key={i}><td>{line.product_name}</td><td>{line.treatment.replaceAll('_',' ')} ({(line.rate_basis_points/100).toFixed(1)}%)</td><td>{money(line.taxable_base)}</td><td>{money(line.vat_amount)}</td></tr>)}</tbody></table></div></section>:null}
   <footer className="invoice-sheet-footer">
    {identity.footer_note&&<p>{identity.footer_note}</p>}
    <p>Thank you for your business.</p>
    <p className="invoice-legal-caption">BusinessOS commercial invoice. Not an NRS-validated electronic invoice or evidence of tax filing. This is an immutable issuance snapshot; payments made afterward may change the current order balance.</p>
   </footer>
  </article>
 </div>;
}
