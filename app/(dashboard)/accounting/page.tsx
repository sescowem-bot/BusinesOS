import {requireBusinessFeature} from '@/lib/server/authorization';
import {redirect} from 'next/navigation';
import {getWorkspace} from '@/lib/server/workspace';
import {money} from '@/lib/format';
import {AccountingSetup,JournalForm} from './forms';
import {AccountingIntegrationForms} from './integration-forms';
import Link from 'next/link';

type PosFinancialHealth={pos_sales:number;confirmed_refunds:number;missing_pos_events:number;missing_refund_events:number;duplicate_invoice_events:number;pos_vat_mismatches:number;refund_mismatches:number;unbalanced_pos_journals:number;unposted_pos_events:number};
const integrityKeys=['missing_pos_events','missing_refund_events','duplicate_invoice_events','pos_vat_mismatches','refund_mismatches','unbalanced_pos_journals'] as const;
export const dynamic='force-dynamic';
async function AccountingWorkspace({showReports}:{showReports:boolean}){
 const {client,businessId,role}=await getWorkspace();
 if(!['owner','manager','finance'].includes(role))redirect('/dashboard');
 const [accountsResult,periodsResult,trialResult,journalsResult,settingsResult,eventsResult,healthResult]=await Promise.all([
  client.from('gl_accounts').select('id,code,name,class,normal_side').eq('business_id',businessId).order('code'),
  client.from('gl_periods').select('id,name,starts_on,ends_on,status').eq('business_id',businessId).order('starts_on',{ascending:false}),
  client.from('gl_trial_balance').select('account_id,code,name,class,debit_turnover,credit_turnover,signed_balance').eq('business_id',businessId).order('code'),
  client.from('gl_journals').select('id,journal_date,description,reference,status,source_type').eq('business_id',businessId).order('journal_date',{ascending:false}).limit(30),
  client.from('gl_integration_settings').select('enabled,cash_account_id,receivable_account_id,advance_account_id,income_account_id,delivery_account_id,tax_account_id,expense_account_id').eq('business_id',businessId).maybeSingle(),
  client.from('gl_source_events').select('id,source_type,occurred_at,status,attempts,last_error,journal_id').eq('business_id',businessId).order('occurred_at',{ascending:false}).limit(100),
  client.rpc('business_pos_accounting_health',{p_business:businessId})
 ]);
 if(accountsResult.error||periodsResult.error||trialResult.error||journalsResult.error)return <section className="tax-page"><h1>Accounting</h1><p role="alert">Accounting records are temporarily unavailable. Please try again or contact support.</p></section>;
 const accounts=accountsResult.data||[],periods=periodsResult.data||[],rows=trialResult.data||[],journals=journalsResult.data||[];
 const events=eventsResult.data||[];
 const debit=rows.reduce((sum,r)=>sum+Math.max(0,Number(r.signed_balance)),0),credit=rows.reduce((sum,r)=>sum+Math.max(0,-Number(r.signed_balance)),0);
 const pending=events.filter(e=>e.status==='pending').length,failed=events.filter(e=>e.status==='error').length;
 const health=!healthResult.error&&healthResult.data&&typeof healthResult.data==='object'&&!Array.isArray(healthResult.data)?healthResult.data as Partial<PosFinancialHealth>:null;
 const integrityIssues=health?integrityKeys.reduce((sum,key)=>sum+Math.max(0,Number(health[key]||0)),0):null;
 return <div className="tax-page"><p className="muted small">FINANCE / GENERAL LEDGER</p><h1>Accounting & General Ledger</h1>
 <p><Link href="/accounting/reconciliation" className="btn">Review transaction reconciliation →</Link></p>
 <p className="muted">Balanced financial records, controlled source postings and transparent reconciliation status.</p>
 <section className="tax-panel"><h2>Trial balance</h2><div className="table-wrap"><table className="table"><thead><tr><th>Code</th><th>Account</th><th>Class</th><th>Debit balance</th><th>Credit balance</th></tr></thead><tbody>{rows.map(r=><tr key={r.account_id}><td>{r.code}</td><td>{r.name}</td><td>{r.class}</td><td>{money(Math.max(0,Number(r.signed_balance)))}</td><td>{money(Math.max(0,-Number(r.signed_balance)))}</td></tr>)}<tr><th colSpan={3}>Totals</th><th>{money(debit)}</th><th>{money(credit)}</th></tr></tbody></table></div>{!rows.length&&<p className="muted">Create your first ledger account and accounting period to begin.</p>}</section>
 {settingsResult.error||eventsResult.error?<section className="tax-panel"><h2>Transaction integration is temporarily unavailable</h2><p role="alert">Transactions could not be loaded. Please try again before enabling automatic posting.</p></section>:<>
 <section className="tax-panel"><h2>Source posting status</h2><div className="grid grid-3"><div><p className="muted small">Auto-posting</p><h3>{settingsResult.data?.enabled?'Enabled':'Paused'}</h3></div><div><p className="muted small">Pending in latest 100</p><h3>{pending}</h3></div><div><p className="muted small">Errors in latest 100</p><h3>{failed}</h3></div></div><p className="muted small">Counts are based on the latest 100 events only. Before relying on financial reports, reconcile all outstanding sources, existing manual journals, opening balances and accounting policies.</p>{failed>0&&<p role="alert" className="negative">Some transactions failed automatic posting. Review their reasons below.</p>}</section>
 <section className="tax-panel"><h2>POS, VAT &amp; refund integrity</h2><p className="muted small">A confirmed POS sale becomes its own revenue and VAT source. Issuing its invoice does not count revenue again. A completed return creates a separate refund reversal, which can only post after the source POS sale.</p>
 {health?<><div className="grid grid-3"><div><p className="muted small">POS sales captured</p><h3>{Number(health.pos_sales||0)}</h3></div><div><p className="muted small">Confirmed refunds</p><h3>{Number(health.confirmed_refunds||0)}</h3></div><div><p className="muted small">Integrity discrepancies</p><h3>{integrityIssues}</h3></div></div>
 {integrityIssues!==null&&integrityIssues>0?<p role="alert" className="negative">Financial-integrity differences detected. Do not rely on POS revenue or VAT balances until the original records and posting errors are reviewed.</p>:<p className="muted small">No structural discrepancies detected in the available source records. This is not a certification that all transactions have been posted or reconciled.</p>}
 <p className="small muted">{Number(health.unposted_pos_events||0)} POS/refund events are pending or require posting review. Unposted events may be normal when automatic integration is paused; investigate before relying on the trial balance.</p>
 </>:<p role="alert">The POS financial-integrity check could not be verified. Review your records before posting.</p>}</section>
 <AccountingIntegrationForms accounts={accounts} settings={settingsResult.data||null}/>
 <section className="tax-panel"><h2>Recent source events</h2><div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Source</th><th>State</th><th>Attempts</th><th>Message</th></tr></thead><tbody>{events.map(e=><tr key={e.id}><td>{new Date(e.occurred_at).toLocaleDateString('en-NG')}</td><td>{e.source_type}</td><td>{e.status}</td><td>{e.attempts}</td><td>{e.last_error?'Needs attention':'—'}</td></tr>)}</tbody></table></div>{!events.length&&<p className="muted">No source events captured yet. Invoices, completed payments, paid expenses, POS sales and confirmed refunds appear here as they are captured.</p>}</section>
 </>}
 <section className="tax-panel"><h2>Chart of accounts & periods</h2><AccountingSetup accounts={accounts} periods={periods}/></section>
 <section className="tax-panel"><h2>Post a manual journal</h2><JournalForm accounts={accounts}/></section>
 <section className="tax-panel"><h2>Recent journals</h2><div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Description</th><th>Source</th><th>Reference</th><th>Status</th></tr></thead><tbody>{journals.map(j=><tr key={j.id}><td>{j.journal_date}</td><td>{j.description}</td><td>{j.source_type}</td><td>{j.reference||'—'}</td><td>{j.status}</td></tr>)}</tbody></table></div>{!journals.length&&<p className="muted">No journals posted yet.</p>}</section>
 {showReports&&<p><Link href="/reports">View financial reports →</Link></p>}</div>;
}
export default async function Page(){
 const access=await requireBusinessFeature('accounting');
 if(!access.allowed)return <section className="tax-page"><h1>Access restricted</h1><p role="alert">{access.reason}</p><Link className="btn" href="/upgrade">View plans</Link></section>;
 const reports=await requireBusinessFeature('financial_reports',{optional:true});
 return <AccountingWorkspace showReports={reports.allowed}/>;
}
