import {requireBusinessFeature} from '@/lib/server/authorization';
import {getWorkspace} from '@/lib/server/workspace';
import {money} from '@/lib/format';
import {AccountingSetup,JournalForm} from './forms';
async function InternalProtectedPage(){
 const {client,businessId,role}=await getWorkspace();
 const allowed=['owner','manager','finance'].includes(role);
 if(!allowed)return <div className="tax-page"><h1>Accounting</h1><p>Only the business owner or authorised finance staff can view the ledger.</p></div>;
 const [{data:accounts,error:ae},{data:periods,error:pe},{data:trial,error:te},{data:journals,error:je}]=await Promise.all([
 client.from('gl_accounts').select('id,code,name,class,normal_side').eq('business_id',businessId).order('code'),
 client.from('gl_periods').select('id,name,starts_on,ends_on,status').eq('business_id',businessId).order('starts_on',{ascending:false}),
 client.from('gl_trial_balance').select('account_id,code,name,class,debit_turnover,credit_turnover,signed_balance').eq('business_id',businessId).order('code'),
 client.from('gl_journals').select('id,journal_date,description,reference,status').eq('business_id',businessId).order('journal_date',{ascending:false}).limit(30)
 ]);
 if(ae||pe||te||je)return <div className="tax-page"><h1>Accounting</h1><p>Accounting data is unavailable. Apply database migration 008 before using this module.</p></div>;
 const rows=trial||[];const debit=rows.reduce((s,r)=>s+Math.max(0,Number(r.signed_balance)),0);const credit=rows.reduce((s,r)=>s+Math.max(0,-Number(r.signed_balance)),0);
 return <div className="tax-page"><p className="muted small">FINANCE / GENERAL LEDGER</p><h1>Accounting & General Ledger</h1><p className="muted">Real ledger records. Manual journals only until automated posting and reconciliations are approved.</p>
 <section className="tax-panel"><h2>Trial balance</h2><div className="table-wrap"><table className="table"><thead><tr><th>Code</th><th>Account</th><th>Class</th><th>Debit balance</th><th>Credit balance</th></tr></thead><tbody>{rows.map(r=><tr key={r.account_id}><td>{r.code}</td><td>{r.name}</td><td>{r.class}</td><td>{money(Math.max(0,Number(r.signed_balance)))}</td><td>{money(Math.max(0,-Number(r.signed_balance)))}</td></tr>)}<tr><th colSpan={3}>Totals</th><th>{money(debit)}</th><th>{money(credit)}</th></tr></tbody></table></div>{!rows.length&&<p className="muted">Start by creating your first ledger account.</p>}</section>
 <section className="tax-panel"><h2>Chart of accounts & periods</h2><AccountingSetup accounts={accounts||[]} periods={periods||[]}/></section>
 <section className="tax-panel"><h2>Record a journal</h2><JournalForm accounts={accounts||[]}/></section>
 <section className="tax-panel"><h2>Recently posted journals</h2><div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Description</th><th>Reference</th><th>Status</th></tr></thead><tbody>{(journals||[]).map(j=><tr key={j.id}><td>{j.journal_date}</td><td>{j.description}</td><td>{j.reference||'—'}</td><td>{j.status}</td></tr>)}</tbody></table></div></section>
 </div>;
}

export default async function GuardedPage(){
 const check=await requireBusinessFeature('accounting');
 if(!check.allowed)return <section className="tax-page"><h1>Access restricted</h1><p role="alert">{check.reason}</p><a className="btn" href="/upgrade">View available plans</a></section>;
 return <InternalProtectedPage/>;
}
