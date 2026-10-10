import {requireBusinessFeature} from '@/lib/server/authorization';
import {getWorkspace} from '@/lib/server/workspace';
import {money} from '@/lib/format';
import {AccountingSetup,JournalForm} from './forms';
import {AccountingIntegrationForms} from './integration-forms';
import Link from 'next/link';
export const dynamic='force-dynamic';
async function AccountingWorkspace(){
 const {client,businessId,role}=await getWorkspace();
 if(!['owner','manager','finance'].includes(role))return <section className="tax-page"><h1>Accounting</h1><p>Only authorised finance roles can access the general ledger.</p></section>;
 const [accountsResult,periodsResult,trialResult,journalsResult,settingsResult,eventsResult]=await Promise.all([
  client.from('gl_accounts').select('id,code,name,class,normal_side').eq('business_id',businessId).order('code'),
  client.from('gl_periods').select('id,name,starts_on,ends_on,status').eq('business_id',businessId).order('starts_on',{ascending:false}),
  client.from('gl_trial_balance').select('account_id,code,name,class,debit_turnover,credit_turnover,signed_balance').eq('business_id',businessId).order('code'),
  client.from('gl_journals').select('id,journal_date,description,reference,status,source_type').eq('business_id',businessId).order('journal_date',{ascending:false}).limit(30),
  client.from('gl_integration_settings').select('enabled,cash_account_id,receivable_account_id,advance_account_id,income_account_id,delivery_account_id,tax_account_id,expense_account_id').eq('business_id',businessId).maybeSingle(),
  client.from('gl_source_events').select('id,source_type,occurred_at,status,attempts,last_error,journal_id').eq('business_id',businessId).order('occurred_at',{ascending:false}).limit(100)
 ]);
 if(accountsResult.error||periodsResult.error||trialResult.error||journalsResult.error)return <section className="tax-page"><h1>Accounting</h1><p role="alert">General ledger data is unavailable. Verify migration 008 and finance permissions.</p></section>;
 const accounts=accountsResult.data||[],periods=periodsResult.data||[],rows=trialResult.data||[],journals=journalsResult.data||[];
 const events=eventsResult.data||[];
 const debit=rows.reduce((sum,r)=>sum+Math.max(0,Number(r.signed_balance)),0),credit=rows.reduce((sum,r)=>sum+Math.max(0,-Number(r.signed_balance)),0);
 const pending=events.filter(e=>e.status==='pending').length,failed=events.filter(e=>e.status==='error').length;
 return <div className="tax-page"><p className="muted small">FINANCE / GENERAL LEDGER</p><h1>Accounting & General Ledger</h1>
 <p className="muted">Balanced financial records, controlled source postings and transparent reconciliation status.</p>
 <section className="tax-panel"><h2>Trial balance</h2><div className="table-wrap"><table className="table"><thead><tr><th>Code</th><th>Account</th><th>Class</th><th>Debit balance</th><th>Credit balance</th></tr></thead><tbody>{rows.map(r=><tr key={r.account_id}><td>{r.code}</td><td>{r.name}</td><td>{r.class}</td><td>{money(Math.max(0,Number(r.signed_balance)))}</td><td>{money(Math.max(0,-Number(r.signed_balance)))}</td></tr>)}<tr><th colSpan={3}>Totals</th><th>{money(debit)}</th><th>{money(credit)}</th></tr></tbody></table></div>{!rows.length&&<p className="muted">Create your first ledger account and accounting period to begin.</p>}</section>
 {settingsResult.error||eventsResult.error?<section className="tax-panel"><h2>Transaction integration requires migration 024</h2><p role="alert">The posting queue could not be loaded. Apply migration 024 after 023 and verify finance access before enabling automation.</p></section>:<>
 <section className="tax-panel"><h2>Source posting status</h2><div className="grid grid-3"><div><p className="muted small">Auto-posting</p><h3>{settingsResult.data?.enabled?'Enabled':'Paused'}</h3></div><div><p className="muted small">Pending in latest 100</p><h3>{pending}</h3></div><div><p className="muted small">Errors in latest 100</p><h3>{failed}</h3></div></div><p className="muted small">Counts are based on the latest 100 events only. Before relying on financial reports, reconcile all outstanding sources, existing manual journals, opening balances and accounting policies.</p>{failed>0&&<p role="alert" className="negative">Some transactions failed automatic posting. Review their reasons below.</p>}</section>
 <AccountingIntegrationForms accounts={accounts} settings={settingsResult.data||null}/>
 <section className="tax-panel"><h2>Recent source events</h2><div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Source</th><th>State</th><th>Attempts</th><th>Message</th></tr></thead><tbody>{events.map(e=><tr key={e.id}><td>{new Date(e.occurred_at).toLocaleDateString('en-NG')}</td><td>{e.source_type}</td><td>{e.status}</td><td>{e.attempts}</td><td>{e.last_error||'—'}</td></tr>)}</tbody></table></div>{!events.length&&<p className="muted">No source events captured yet. New documents and completed payments will appear after the migration.</p>}</section>
 </>}
 <section className="tax-panel"><h2>Chart of accounts & periods</h2><AccountingSetup accounts={accounts} periods={periods}/></section>
 <section className="tax-panel"><h2>Post a manual journal</h2><JournalForm accounts={accounts}/></section>
 <section className="tax-panel"><h2>Recent journals</h2><div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Description</th><th>Source</th><th>Reference</th><th>Status</th></tr></thead><tbody>{journals.map(j=><tr key={j.id}><td>{j.journal_date}</td><td>{j.description}</td><td>{j.source_type}</td><td>{j.reference||'—'}</td><td>{j.status}</td></tr>)}</tbody></table></div>{!journals.length&&<p className="muted">No journals posted yet.</p>}</section>
 <p><Link href="/reports">View financial reports →</Link></p></div>;
}
export default async function Page(){
 const access=await requireBusinessFeature('accounting');
 if(!access.allowed)return <section className="tax-page"><h1>Access restricted</h1><p role="alert">{access.reason}</p><Link className="btn" href="/upgrade">View plans</Link></section>;
 return <AccountingWorkspace/>;
}
