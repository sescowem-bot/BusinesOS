import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireBusinessFeature} from '@/lib/server/authorization';
import {PrintDocumentButton} from '@/components/print-document-button';
import {money} from '@/lib/format';
export const dynamic='force-dynamic';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type CreditSnapshot={original_order_id?:string;original_order_number?:string;original_invoice?:string;seller_name?:string;seller_logo_url?:string;seller_registration_number?:string;seller_tin?:string;seller_footer?:string;customer_name?:string;item_name?:string;quantity?:number;reason?:string;net_credit?:number;vat_credit?:number;total_credit?:number;vat_treatment?:string;vat_rate_basis_points?:number;refund_method?:string;refund_reference?:string;restocked?:boolean};
export default async function CreditNote({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!UUID.test(id))notFound();
 const access=await requireBusinessFeature('pos');if(!access.allowed)return <p role="alert">{access.reason}</p>;
 const {client,businessId}=access;
 const {data:credit,error}=await 
  client.from('business_pos_credit_notes').select('id,credit_number,issued_at,return_id,snapshot').eq('id',id).eq('business_id',businessId).maybeSingle();
 if(error)throw new Error('Credit note details could not be verified.');if(!credit)notFound();
 const s=(credit.snapshot||{}) as CreditSnapshot;
 const issueDate=new Date(credit.issued_at).toLocaleDateString('en-NG',{day:'2-digit',month:'short',year:'numeric'});
 const logo=s.seller_logo_url&&/^https:\/\//.test(s.seller_logo_url)?s.seller_logo_url:'';
 return <div className="invoice-view bo-credit-view"><nav className="invoice-view-actions print-hidden" aria-label="Credit note actions"><Link className="btn" href={`/returns/${credit.return_id}`}>← Return record</Link><PrintDocumentButton/></nav>
  <article className="invoice-sheet" aria-label={`Credit note ${credit.credit_number}`}>
   <div className="invoice-accent"/><header className="invoice-head"><div className="invoice-seller"><div className="invoice-seller-main">{logo?<img src={logo} alt="Business logo" className="invoice-logo"/>:<span className="invoice-logo-fallback">{(s.seller_name||'B').slice(0,1)}</span>}<div><h1>{s.seller_name||'Business'}</h1>{s.seller_registration_number&&<p className="invoice-muted">RC / BN: {s.seller_registration_number}</p>}{s.seller_tin&&<p className="invoice-muted">TIN: {s.seller_tin}</p>}</div></div></div><div className="invoice-number-block"><span className="invoice-eyebrow">CREDIT NOTE</span><strong>{credit.credit_number}</strong><span className="invoice-status-chip">Issued</span></div></header>
   <div className="invoice-meta-grid"><section><span className="invoice-field-label">ORIGINAL SALE</span><h2>{s.customer_name||'Customer'}</h2><p>Original sale: {s.original_order_number||'POS order'}</p>{s.original_invoice&&<p>Original invoice: {s.original_invoice}</p>}{s.original_order_id&&<p>Order reference: {s.original_order_id}</p>}</section><section className="invoice-meta-dates"><span className="invoice-field-label">ISSUE DATE</span><strong>{issueDate}</strong><p>Customer refund recorded outside BusinessOS.</p></section></div>
   <div className="invoice-items-wrap"><table className="invoice-items"><thead><tr><th>Description</th><th>Quantity</th><th>Net credit</th><th>VAT reversal</th></tr></thead><tbody><tr><td data-heading="Item">{s.item_name||'Returned POS item'}</td><td data-heading="Quantity">{Number(s.quantity||0)}</td><td data-heading="Net credit">{money(Number(s.net_credit||0))}</td><td data-heading="VAT">{money(Number(s.vat_credit||0))}</td></tr></tbody></table></div>
   <div className="invoice-settlement"><div className="invoice-help"><span className="invoice-field-label">RETURN REASON</span><p>{s.reason}</p><p className="small muted">VAT classification at sale: {s.vat_treatment?.replaceAll('_',' ')||'Unverified'}{s.vat_treatment&&s.vat_treatment!=='unverified'?` · ${Number(s.vat_rate_basis_points||0)/100}%`:''}.</p><p className="small muted">Refund evidence: {s.refund_reference||'—'} ({s.refund_method||'—'})</p></div>
   <div className="invoice-amounts"><div><span>Net item credit</span><strong>{money(Number(s.net_credit||0))}</strong></div><div><span>VAT reversal</span><strong>{money(Number(s.vat_credit||0))}</strong></div><div className="invoice-total"><span>Total credited / refunded</span><strong>{money(Number(s.total_credit||0))}</strong></div></div></div>
   <footer className="invoice-sheet-footer"><p>{s.seller_footer||'Thank you for your business.'}</p><p className="invoice-legal-caption">This BusinessOS commercial credit note references the original POS sale. It is not an NRS-validated tax credit note or proof of bank settlement. Finance teams must reconcile this separately with accounting and VAT returns.</p></footer>
  </article>
 </div>;
}
