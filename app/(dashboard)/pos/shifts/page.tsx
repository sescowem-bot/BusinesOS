import Link from 'next/link';
import {requireBusinessFeature} from '@/lib/server/authorization';
import {BusinessPageHeading,BusinessAlert,BusinessSection,BusinessSummary} from '@/components/business-page-ui';
import {formatCash} from '@/lib/cashier-format';
import {OpenShiftForm} from '../shift-forms';
export const dynamic='force-dynamic';
export default async function CashierShifts(){
 const access=await requireBusinessFeature('pos');
 if(!access.allowed)return <div className="bo-page"><BusinessPageHeading eyebrow="POS / CASH MANAGEMENT" title="Cashier shifts" description="Available to businesses with Software POS access."/><BusinessAlert>{access.reason}</BusinessAlert></div>;
 const {client,businessId,userId,role}=access;
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const [shiftResult,exceptionsResult,dailyResult]=await Promise.all([
  client.from('business_pos_cashier_shifts').select('id,cashier_id,status,opened_at,closed_at,opening_cash,expected_cash,counted_cash,variance,sales_cash_total').eq('business_id',businessId).order('opened_at',{ascending:false}).limit(50),
  client.rpc('business_pos_cash_exceptions',{p_business:businessId}),
  ['owner','manager'].includes(role)?client.rpc('business_pos_daily_cash_report',{p_business:businessId,p_date:today}):Promise.resolve({data:null,error:null})
 ]);
 if(shiftResult.error||exceptionsResult.error||(dailyResult.error&&['owner','manager'].includes(role)))return <div className="bo-page"><BusinessPageHeading eyebrow="POS / CASH MANAGEMENT" title="Cashier shifts" description="Shift records are currently unavailable."/><BusinessAlert>Shift tables could not be verified. Confirm SQL 037 is installed and that POS permissions are active. Avoid recording cash outside an approved shift.</BusinessAlert></div>;
 const ex=exceptionsResult.data as {pos_sales_without_shift:number;cash_payments_without_shift_receipt:number;changed_cash_payment_records:number;cash_refunds_without_matching_cash_out:number};
 const daily=dailyResult.data as {shifts:number;open_shifts:number;awaiting_review:number;reviewed:number;flagged:number;closed_shift_captured_cash:number;net_variance:number}|null;
 const shifts=shiftResult.data||[];
 const mine=shifts.find(s=>s.cashier_id===userId&&s.status==='open');
 const active=shifts.filter(s=>s.status==='open').length;
 const pending=shifts.filter(s=>s.status==='closed').length;
 const canOpen=['owner','manager','sales'].includes(role);
 return <div className="bo-page">
  <BusinessPageHeading eyebrow="POS / CONTROL CENTRE" title="Cashier shifts & reconciliation" description="Open a till, capture physical cash movements, record closing cash and submit a variance for review." action={{href:'/pos',label:'Retail checkout'}}/>
  <BusinessSummary items={[{label:'Open shifts in loaded list',value:active,detail:'Most recent 50 shifts'},{label:'Pending management review',value:pending,detail:'Most recent 50 shifts'},{label:'Unassigned POS sales',value:ex.pos_sales_without_shift,detail:'All recorded POS sales',warning:ex.pos_sales_without_shift>0},{label:'Unassigned cash payments',value:ex.cash_payments_without_shift_receipt,detail:'Require management investigation',warning:ex.cash_payments_without_shift_receipt>0}]}/>
  <BusinessAlert>Only cash receipts captured during an active shift count towards the expected physical till balance. Transfers and external card/POS payments do not count as cash. Confirmed cash refunds must be logged as a separate documented cash-out movement. Unassigned POS sales and payments need independent review; the shift report is not a complete general-ledger reconciliation.</BusinessAlert>
  {(ex.changed_cash_payment_records>0||ex.cash_refunds_without_matching_cash_out>0)&&<BusinessAlert>Attention: {ex.changed_cash_payment_records} captured payment records were later changed, and {ex.cash_refunds_without_matching_cash_out} cash refund records have no matching cash-out voucher and amount. Resolve these before approving daily reconciliation.</BusinessAlert>}
  {daily&&<BusinessSummary items={[{label:`Lagos daily report · ${today}`,value:daily.shifts,detail:"Shifts opened on this date"},{label:"Closed shifts awaiting review",value:daily.awaiting_review,warning:daily.awaiting_review>0},{label:"Closed shift cash receipts",value:formatCash(Number(daily.closed_shift_captured_cash)),detail:"Does not include open shifts"},{label:"Combined counted variance",value:formatCash(Number(daily.net_variance)),warning:Number(daily.net_variance)!==0} ]}/>}
  <div className="grid grid-2">
   <section className="card card-pad"><h2 className="section-title">{mine?'Your active shift':'Start a cashier shift'}</h2>
    {mine?<><p className="small muted">Opened {new Date(mine.opened_at).toLocaleString('en-NG')} · Float {formatCash(Number(mine.opening_cash))}</p><p><Link href={`/pos/shifts/${mine.id}`} className="btn btn-primary">Manage your shift</Link></p></>:canOpen?<OpenShiftForm/>:<p className="muted">Only authorised cashier, manager or owner roles may open shifts.</p>}
   </section>
   <section className="card card-pad"><h2 className="section-title">Daily till control</h2><ol className="bo-return-steps"><li>Count opening cash and open your shift.</li><li>Record POS cash receipts through checkout; record other cash-ins and cash-outs with vouchers.</li><li>At closing, count physical cash and record the counted amount.</li><li>The system freezes expected balance and variance.</li><li>A business owner or manager reviews the closed shift.</li></ol></section>
  </div>
  {shifts.length===50&&<BusinessAlert>The register displays only the latest 50 visible shifts; these counts are not complete financial-period totals.</BusinessAlert>}
  <BusinessSection title="Shift register" description="Cashier-specific details are visible only to their cashier and authorised managers or owners.">
   <div className="table-wrap"><table className="table"><thead><tr><th>Opened</th><th>Cashier</th><th>Status</th><th>Opening</th><th>Expected at close</th><th>Variance</th><th>Action</th></tr></thead><tbody>{shifts.map(s=><tr key={s.id}><td>{new Date(s.opened_at).toLocaleString('en-NG')}</td><td>{s.cashier_id===userId?'My shift':`${s.cashier_id.slice(0,8)}…`}</td><td><span className={`bo-status ${s.status==='reviewed'?'bo-tone-success':s.status==='flagged'?'bo-tone-danger':s.status==='closed'?'bo-tone-warning':''}`}>{s.status}</span></td><td>{formatCash(Number(s.opening_cash))}</td><td>{s.expected_cash===null?'Open':formatCash(Number(s.expected_cash))}</td><td>{s.variance===null?'—':formatCash(Number(s.variance))}</td><td><Link href={`/pos/shifts/${s.id}`}>View / review</Link></td></tr>)}</tbody></table></div>
   {!shifts.length&&<p className="muted" style={{padding:20}}>No cashier shifts recorded yet.</p>}
  </BusinessSection>
 </div>;
}
