import {requireBusinessFeature} from '@/lib/server/authorization';
import Link from 'next/link';
import {money} from '@/lib/format';
import {financialContext,loadTrial} from '@/lib/reporting/server';
import {balanceSheet,profitAndLoss,trialBalance} from '@/lib/reporting/financial';
import {BusinessPageHeading,BusinessSummary} from '@/components/business-page-ui';
async function InternalProtectedPage(){
 let rows;try{await financialContext();rows=await loadTrial()}catch(e){return <section className="tax-page"><h1>Financial Reports</h1><p role="alert">Reports unavailable. You need finance permission and migration 008.</p></section>}
 const tb=trialBalance(rows),pl=profitAndLoss(rows),bs=balanceSheet(rows);
 return <div className="tax-page"><BusinessPageHeading eyebrow="FINANCE / REPORTING" title="Financial reports" description="Figures are derived only from posted general-ledger journals, not directly from all customer orders and payments."/><p className="muted">Before relying on these statements, <Link href="/accounting/reconciliation">reconcile accounting source events</Link> to identify pending, failed or historical transactions.</p><BusinessSummary items={[{label:"Posted ledger income",value:money(pl.income)},{label:"Posted ledger expenses",value:money(pl.expense)},{label:"Net ledger result",value:money(pl.net)},{label:"Trial balance difference",value:money(tb.difference),warning:tb.difference!==0}]}/>
 <section className="tax-panel"><h2>Financial summary</h2><div className="grid grid-2"><div><p className="muted">Ledger income</p><h3>{money(pl.income)}</h3></div><div><p className="muted">Ledger expenses</p><h3>{money(pl.expense)}</h3></div><div><p className="muted">Net ledger result</p><h3>{money(pl.net)}</h3></div><div><p className="muted">Trial balance difference</p><h3>{money(tb.difference)}</h3></div></div>{tb.difference!==0&&<p role="alert" className="negative">Warning: trial balance is not balanced. Do not rely on these statements.</p>}</section>
 <section className="tax-panel"><h2>Profit and loss</h2><div className="list"><div className="list-row"><span>Income</span><b>{money(pl.income)}</b></div><div className="list-row"><span>Expenses</span><b>{money(pl.expense)}</b></div><div className="list-row"><strong>Net result</strong><b>{money(pl.net)}</b></div></div></section>
 <section className="tax-panel"><h2>Balance sheet (simplified)</h2><div className="list"><div className="list-row"><span>Assets</span><b>{money(bs.assets)}</b></div><div className="list-row"><span>Liabilities</span><b>{money(bs.liabilities)}</b></div><div className="list-row"><span>Recorded equity</span><b>{money(bs.equity)}</b></div><div className="list-row"><span>Current earnings</span><b>{money(bs.currentEarnings)}</b></div><div className="list-row"><strong>Reconciliation difference</strong><b>{money(bs.difference)}</b></div></div><p className="muted">Does not yet support all year-end adjustments or retained earnings closing.</p></section>
 <section className="tax-panel"><h2>Trial balance</h2><div className="table-wrap"><table className="table"><thead><tr><th>Code</th><th>Account</th><th>Class</th><th>Debit</th><th>Credit</th></tr></thead><tbody>{rows.map(r=><tr key={r.account_id}><td>{r.code}</td><td>{r.name}</td><td>{r.class}</td><td>{money(Math.max(0,r.signed_balance))}</td><td>{money(Math.max(0,-r.signed_balance))}</td></tr>)}<tr><th colSpan={3}>Total</th><th>{money(tb.debit)}</th><th>{money(tb.credit)}</th></tr></tbody></table></div>{!rows.length&&<p className="muted">No posted ledger entries yet.</p>}</section>
 <section className="tax-panel"><h2>Accountant-ready CSV exports</h2><p className="muted">Exports are generated server-side and scoped to your business membership.</p><div className="grid grid-2"><Link className="btn" href="/api/reports/export?kind=trial">Download trial balance CSV</Link><Link className="btn" href="/api/reports/export?kind=ledger">Download general ledger CSV</Link><Link className="btn" href="/api/reports/export?kind=tax-review">Download VAT review schedule CSV</Link></div><p className="muted small">CSV opens in Excel. Tax review schedules are not VAT returns and contain no automatic tax filing.</p></section>
 <p><Link href="/retail-reports">Open indexed POS retail performance →</Link></p><p><Link href="/tax-compliance">Open Tax Compliance Centre →</Link></p>
 </div>;
}

export default async function GuardedPage(){
 const check=await requireBusinessFeature('financial_reports');
 if(!check.allowed)return <section className="tax-page"><h1>Access restricted</h1><p role="alert">{check.reason}</p><a className="btn" href="/upgrade">View available plans</a></section>;
 return <InternalProtectedPage/>;
}
