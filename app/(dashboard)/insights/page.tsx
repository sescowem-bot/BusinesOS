import Link from 'next/link';
import {loadBusinessInsights} from '@/lib/insights/server';
import {money} from '@/lib/format';
const asMoney=(kobo:number)=>money(kobo/100);
export default async function InsightsPage(){
 let report:Awaited<ReturnType<typeof loadBusinessInsights>>;
 try{report=await loadBusinessInsights()}catch(e){return <div className="tax-page"><h1>Business Intelligence</h1><p role="alert">Insights unavailable. Check your workspace access, database migrations and reporting data.</p><Link href="/dashboard">Return to dashboard</Link></div>}
 const {current:c,previous:p,insights}=report;
 return <div className="tax-page"><p className="muted small">BUSINESS / INTELLIGENCE</p><h1>Business Intelligence</h1><p className="muted">Transaction-based insights for the current calendar month. Figures here are operational, not audited financial statements.</p>
 <div className="grid grid-3">
 {([{label:'Orders this month',value:String(c.orders)},{label:'Sales this month',value:asMoney(c.sales)},{label:'Money received this month',value:asMoney(c.received)},{label:'Expenses this month',value:asMoney(c.expenses)},{label:'All-time outstanding',value:asMoney(c.outstanding)},{label:'Overdue orders',value:String(c.overdueCount)}]).map(x=><section className="tax-panel" key={x.label}><p className="muted small">{x.label}</p><h2>{x.value}</h2></section>)}
 </div>
 <section className="tax-panel"><h2>Business insights</h2><div className="grid grid-2">{insights.map(x=><div className="card card-pad" key={x.title}><p className="muted small">{x.severity==='warning'?'NEEDS ATTENTION':x.severity==='positive'?'POSITIVE SIGNAL':'INFORMATION'}</p><h3>{x.title}</h3><p>{x.detail}</p><Link href={x.href}>View details →</Link></div>)}</div></section>
 <section className="tax-panel"><h2>Month comparison</h2><div className="table-wrap"><table className="table"><thead><tr><th>Metric</th><th>Previous month</th><th>Current month</th></tr></thead><tbody><tr><td>Sales by order date</td><td>{asMoney(p.sales)}</td><td>{asMoney(c.sales)}</td></tr><tr><td>Received payments</td><td>{asMoney(p.received)}</td><td>{asMoney(c.received)}</td></tr><tr><td>Recorded expenses</td><td>{asMoney(p.expenses)}</td><td>{asMoney(c.expenses)}</td></tr><tr><td>Number of orders</td><td>{p.orders}</td><td>{c.orders}</td></tr></tbody></table></div></section>
 <section className="tax-panel"><h2>Inventory attention</h2><p className="muted">Stock valuation uses recorded unit costs; it is not a substitute for reconciled inventory accounts.</p><p>Stock value at recorded cost: <strong>{asMoney(c.inventoryValue)}</strong></p><div className="table-wrap"><table className="table"><thead><tr><th>Product</th><th>Available</th><th>Minimum</th></tr></thead><tbody>{c.lowStock.map(x=><tr key={x.id}><td>{x.name}</td><td>{x.stock_quantity}</td><td>{x.minimum_stock}</td></tr>)}</tbody></table></div>{!c.lowStock.length&&<p>No low-stock warnings.</p>}</section>
 <p className="muted small">Important: cancellations are excluded from sales; only completed payments count as received. Outstanding balances use existing orders and payments. Refunds, reversals, taxes and manual journals may need further reconciliation. Use <Link href="/reports">Financial Reports</Link> for ledger-based financial statements.</p></div>
}
