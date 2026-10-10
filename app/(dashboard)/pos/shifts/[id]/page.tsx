import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireBusinessFeature} from '@/lib/server/authorization';
import {formatCash} from '@/lib/cashier-format';
import {BusinessPageHeading,BusinessAlert,BusinessSummary,BusinessSection} from '@/components/business-page-ui';
import {MovementForm,CloseShiftForm,ReviewShiftForm} from '../../shift-forms';
export const dynamic='force-dynamic';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type ShiftTotals={opening:number;cash_sales_and_receipts:number;cash_in:number;cash_out:number;expected:number;status:string;counted:number|null;variance:number|null};
export default async function CashierShiftReport({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!UUID.test(id))notFound();
 const access=await requireBusinessFeature('pos');if(!access.allowed)return <div className="bo-page"><BusinessAlert>{access.reason}</BusinessAlert></div>;
 const {client,businessId,userId,role}=access;
 const [shiftResult,receiptsResult,movementsResult,totalsResult]=await Promise.all([
  client.from('business_pos_cashier_shifts').select('id,business_id,cashier_id,status,opened_at,closed_at,opening_cash,counted_cash,expected_cash,variance,close_note,reviewed_at,review_note').eq('business_id',businessId).eq('id',id).maybeSingle(),
  client.from('business_pos_shift_receipts').select('id,payment_id,amount,captured_at').eq('business_id',businessId).eq('shift_id',id).order('captured_at',{ascending:false}).limit(100),
  client.from('business_pos_cash_movements').select('id,kind,amount,reason,reference,recorded_at').eq('business_id',businessId).eq('shift_id',id).order('recorded_at',{ascending:false}).limit(100),
  client.rpc('business_pos_shift_totals',{p_business:businessId,p_shift:id})
 ]);
 if(shiftResult.error)throw new Error('Unable to load cashier shift.');if(!shiftResult.data)notFound();
 if(receiptsResult.error||movementsResult.error||totalsResult.error||!totalsResult.data)return <div className="bo-page"><BusinessAlert>Reconciliation could not be verified. Do not close this shift until receipts, cash movements and totals are available.</BusinessAlert><Link href="/pos/shifts">Back to shifts</Link></div>;
 const s=shiftResult.data;const totals=totalsResult.data as ShiftTotals;
 const own=s.cashier_id===userId;
 const reviewer=['owner','manager'].includes(role)&&(!own||role==='owner');
 const dateTime=(value:string)=>new Date(value).toLocaleString('en-NG');
 return <div className="bo-page">
  <BusinessPageHeading eyebrow="POS / CASHIER CONTROL" title={`Cashier shift ${id.slice(0,8).toUpperCase()}`} description={`Opened ${dateTime(s.opened_at)} · ${s.status.toUpperCase()}`} action={{href:'/pos/shifts',label:'All shifts'}}/>
  <BusinessSummary items={[{label:'Opening cash',value:formatCash(Number(totals.opening))},{label:'Captured POS cash receipts',value:formatCash(Number(totals.cash_sales_and_receipts))},{label:'Cash added / removed',value:`+ ${formatCash(Number(totals.cash_in))} / − ${formatCash(Number(totals.cash_out))}`},{label:s.status==='open'?'Current expected cash':'Expected cash at close',value:formatCash(Number(s.status==='open'?totals.expected:s.expected_cash)),detail:'Recorded physical cash only'},{label:'Counted closing cash',value:s.counted_cash===null?'Not closed':formatCash(Number(s.counted_cash))},{label:'Recorded variance',value:s.variance===null?'Not closed':formatCash(Number(s.variance)),warning:s.variance!==null&&Number(s.variance)!==0}]}/>
  <BusinessAlert>Closing cash = opening float + captured cash receipts + cash in − cash out. This is a physical till reconciliation, not a profit report. Cash refunds are NOT automatically deducted: record each verified cash refund as cash out using its voucher number. Receipts recorded outside a shift require separate management review.</BusinessAlert>
  {s.status==='open'&&own&&<div className="grid grid-2"><section className="card card-pad"><h2 className="section-title">Cash in / cash out</h2><MovementForm shiftId={id}/></section><section className="card card-pad"><h2 className="section-title">Close my shift</h2><p className="small muted">Reconcile and count the physical till. The expected amount and variance are frozen on close.</p><CloseShiftForm shiftId={id}/></section></div>}
  {s.status==='open'&&!own&&<BusinessAlert>This shift is still open. Only the original cashier can record movements or close it.</BusinessAlert>}
  {s.status==='closed'&&(reviewer?<BusinessSection title="Supervisor review" description="Accept the recorded difference or flag this shift for investigation; this does not change the amounts."><div style={{padding:20}}><ReviewShiftForm shiftId={id} variance={Number(s.variance)}/></div></BusinessSection>:<BusinessAlert>Awaiting owner/manager review. A manager cannot approve their own shift.</BusinessAlert>)}
  {(s.status==='reviewed'||s.status==='flagged')&&<BusinessSection title="Management decision" description={`Review recorded ${s.reviewed_at?dateTime(s.reviewed_at):''}`}><div style={{padding:20}}><p><strong>Status: {s.status}</strong></p><p>{s.review_note||'No review note'}</p></div></BusinessSection>}
  {s.close_note&&<p className="small muted">Cashier close note: {s.close_note}</p>}
  {(receiptsResult.data||[]).length===100||(movementsResult.data||[]).length===100?<BusinessAlert>Audit line previews are limited to 100 each. Summary totals are calculated from all database records.</BusinessAlert>:null}
  <BusinessSection title="Captured cash payment references" description="These cash payment snapshots are associated with the shift. Non-cash payment methods are excluded.">
   <div className="table-wrap"><table className="table"><thead><tr><th>Captured</th><th>Payment ID</th><th>Cash amount</th></tr></thead><tbody>{(receiptsResult.data||[]).map(r=><tr key={r.id}><td>{dateTime(r.captured_at)}</td><td>{r.payment_id.slice(0,8)}…</td><td>{formatCash(Number(r.amount))}</td></tr>)}</tbody></table></div>
   {!receiptsResult.data?.length&&<p className="muted" style={{padding:18}}>No POS cash receipts were captured in this shift.</p>}
  </BusinessSection>
  <BusinessSection title="Cash movement audit" description="Every float addition or cash removal has a reference and explanation.">
   <div className="table-wrap"><table className="table"><thead><tr><th>Recorded</th><th>Direction</th><th>Amount</th><th>Voucher</th><th>Reason</th></tr></thead><tbody>{(movementsResult.data||[]).map(m=><tr key={m.id}><td>{dateTime(m.recorded_at)}</td><td>{m.kind==='cash_in'?'Cash in':'Cash out'}</td><td>{formatCash(Number(m.amount))}</td><td>{m.reference}</td><td>{m.reason}</td></tr>)}</tbody></table></div>
   {!movementsResult.data?.length&&<p className="muted" style={{padding:18}}>No manual cash movements recorded.</p>}
  </BusinessSection>
  <p className="bo-back-link"><Link href="/pos">← Return to checkout</Link></p>
 </div>;
}
