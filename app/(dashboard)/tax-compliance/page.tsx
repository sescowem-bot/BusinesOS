import Link from 'next/link';
import {financialContext} from '@/lib/reporting/server';
export default async function TaxCompliancePage(){
 let context;try{context=await financialContext()}catch{return <div className="tax-page"><h1>Tax compliance</h1><p>Finance permission required.</p></div>}
 const {client,businessId}=context;
 const [{data:profile,error:profileError},{data:snapshots,error:snapshotError},{data:deadlines,error:deadlineError}]=await Promise.all([
  client.from('business_tax_profiles').select('*').eq('business_id',businessId).maybeSingle(),
  client.from('tax_calculation_snapshots').select('id,tax_date,transaction_reference,status,created_at').eq('business_id',businessId).order('tax_date',{ascending:false}).limit(30),
  client.from('tax_obligation_reminders').select('id,tax_kind,period_end,due_date,status,notes').eq('business_id',businessId).order('due_date',{ascending:true}).limit(30)
 ]);
 return <div className="tax-page"><p className="muted small">FINANCE / TAX COMPLIANCE</p><h1>Tax Compliance Centre</h1><p className="muted">Review supporting records and manage manually verified obligations. This page does not submit returns or remit taxes.</p>
 <section className="tax-notice"><strong>Do not assume a filing obligation.</strong><p>VAT and other tax deadlines depend on verified business eligibility, transaction treatment and law in force. Consult an authorised adviser before confirming filing requirements.</p></section>
 <section className="tax-panel"><h2>Tax profile</h2>{profileError?<p role="alert">Tax profile unavailable; check migration 005.</p>:profile?<p>Business tax profile exists. <Link href="/tax-profile">Review profile</Link> and verify all current eligibility information.</p>:<p>No profile completed. <Link href="/tax-profile">Complete Tax Discovery</Link>.</p>}</section>
 <section className="tax-panel"><h2>Compliance reminders</h2>{deadlineError?<p role="alert">Apply migration 010 to enable compliance reminders.</p>:<div className="table-wrap"><table className="table"><thead><tr><th>Tax type</th><th>Period end</th><th>Due date</th><th>Status</th><th>Note</th></tr></thead><tbody>{(deadlines||[]).map(d=><tr key={d.id}><td>{d.tax_kind.toUpperCase()}</td><td>{d.period_end}</td><td>{d.due_date}</td><td>{d.status}</td><td>{d.notes}</td></tr>)}</tbody></table></div>}{!deadlineError&&!deadlines?.length&&<p className="muted">No verified reminders have been scheduled. Do not interpret this as proof that no tax is due.</p>}</section>
 <section className="tax-panel"><h2>Recorded calculation reviews</h2>{snapshotError?<p role="alert">Tax snapshots unavailable; check migration 009.</p>:<div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Transaction</th><th>Review status</th></tr></thead><tbody>{(snapshots||[]).map(s=><tr key={s.id}><td>{s.tax_date}</td><td>{s.transaction_reference||s.id}</td><td>{s.status}</td></tr>)}</tbody></table></div>}{!snapshotError&&!snapshots?.length&&<p className="muted">No tax calculation snapshots available.</p>}</section>
 <section className="tax-panel"><h2>Export compliance evidence</h2><p className="muted">Use <Link href="/api/reports/export?kind=tax-review">the CSV review schedule</Link> to inspect recorded cases in Excel. An approved VAT return needs additional transaction-level data and reconciliation.</p></section>
 </div>;
}
