import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireBusinessFeature} from '@/lib/server/authorization';
import {money} from '@/lib/format';
import {BusinessPageHeading,BusinessSection,BusinessAlert,BusinessSummary} from '@/components/business-page-ui';
import {ReturnReviewForm,ReturnCompleteForm} from '../forms';
export const dynamic='force-dynamic';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function ReturnDetails({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!UUID.test(id))notFound();
 const access=await requireBusinessFeature('pos');if(!access.allowed)return <div className="bo-page"><BusinessAlert>{access.reason}</BusinessAlert></div>;
 const {client,businessId,role}=access;
 const [{data:r,error},{data:note,error:noteError},{data:refund,error:refundError}]=await Promise.all([
  client.from('business_pos_returns').select('id,order_id,order_item_id,quantity,net_credit,vat_credit,gross_credit,reason,status,requested_by,requested_at,reviewed_by,reviewed_at,review_note,completed_at,restocked').eq('business_id',businessId).eq('id',id).maybeSingle(),
  client.from('business_pos_credit_notes').select('id,credit_number').eq('business_id',businessId).eq('return_id',id).maybeSingle(),
  client.from('business_pos_refunds').select('amount,method,external_reference,confirmed_at').eq('business_id',businessId).eq('return_id',id).maybeSingle()
 ]);
 if(error)throw new Error('Return detail could not be loaded.');if(!r)notFound();
 if(noteError||refundError)return <div className="bo-page"><BusinessAlert>Credit note or refund records could not be verified. Retry before proceeding.</BusinessAlert></div>;
 const [{data:order},{data:item}]=await Promise.all([
  client.from('orders').select('order_number').eq('business_id',businessId).eq('id',r.order_id).maybeSingle(),
  client.from('order_items').select('name_snapshot,quantity').eq('id',r.order_item_id).eq('order_id',r.order_id).maybeSingle()
 ]);
 const canReview=['owner','manager'].includes(role)&&!(r.requested_by===access.userId&&role==='manager');
 return <div className="bo-page"><BusinessPageHeading eyebrow="SALES / RETURNS" title={`Return ${id.slice(0,8).toUpperCase()}`} description={`State: ${r.status}. All amounts relate to a previously recorded POS sale.`} action={{href:'/returns',label:'All returns'}}/>
  <p className="bo-back-link"><Link href={`/orders/${r.order_id}`}>View original order {order?.order_number||''}</Link></p>
  <BusinessSummary items={[{label:'Net credit',value:money(Number(r.net_credit))},{label:'VAT reversal',value:money(Number(r.vat_credit))},{label:'Total credit / refund',value:money(Number(r.gross_credit))}]}/>
  <BusinessSection title="Request details" description="The original issued invoice remains unchanged; corrections are evidenced by a separate credit note.">
   <div className="bo-detail-list"><div className="bo-detail-row"><span>Returned item</span><strong>{item?.name_snapshot||'Sale item'}</strong></div><div className="bo-detail-row"><span>Returned quantity</span><strong>{Number(r.quantity)}</strong></div><div className="bo-detail-row"><span>Reason</span><strong>{r.reason}</strong></div><div className="bo-detail-row"><span>Requested on</span><strong>{new Date(r.requested_at).toLocaleString('en-NG')}</strong></div>{r.review_note&&<div className="bo-detail-row"><span>Review note</span><strong>{r.review_note}</strong></div>}{r.completed_at&&<div className="bo-detail-row"><span>Completion</span><strong>{new Date(r.completed_at).toLocaleString('en-NG')}</strong></div>}</div>
  </BusinessSection>
  {r.status==='requested'&&(canReview?<BusinessSection title="Manager / owner decision" description="Approval does not automatically refund the customer or restore stock."><ReturnReviewForm returnId={id}/></BusinessSection>:<BusinessAlert>An independent owner or manager must review this request. A manager cannot approve their own request.</BusinessAlert>)}
  {r.status==='approved'&&(canReview?<BusinessSection title="Confirm external refund and stock" description="Complete only after actually paying the customer back outside BusinessOS."><ReturnCompleteForm returnId={id} amount={Number(r.gross_credit)}/></BusinessSection>:<BusinessAlert>The approved return is awaiting owner/manager settlement confirmation.</BusinessAlert>)}
  {r.status==='rejected'&&<BusinessAlert>This return was rejected. No credit note, recorded refund or stock movement was created.</BusinessAlert>}
  {r.status==='completed'&&<BusinessSection title="Completed refund" description="The refund and credit note were recorded in one database transaction.">
   <p>Recorded refund: <strong>{money(Number(refund?.amount||0))}</strong> · {refund?.method||'Unknown method'}</p>
   <p>Evidence/reference: <strong>{refund?.external_reference||'Unavailable'}</strong></p>
   <p>Saleable inventory restored: <strong>{r.restocked?'Yes':'No'}</strong></p>
   {note?<p><Link className="btn btn-primary" href={`/returns/credit-notes/${note.id}`}>View / print credit note {note.credit_number}</Link></p>:<BusinessAlert>Credit note is not visible. Contact platform support before reconciling the return.</BusinessAlert>}
  </BusinessSection>}
  <p className="small muted">This workflow does not reverse an external payment automatically or post ledger/tax adjustment journals. Finance teams must reconcile credit notes and recorded refunds outside gross-sales summaries.</p>
 </div>;
}
