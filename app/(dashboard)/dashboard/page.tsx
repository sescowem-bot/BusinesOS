import Link from 'next/link';
import {loadBusinessInsights} from '@/lib/insights/server';
import {money} from '@/lib/format';
export const dynamic = 'force-dynamic';
const amount=(kobo:number)=>money(kobo/100);
export default async function Dashboard(){
 const {current:c,previous:p,insights}=await loadBusinessInsights();
 const stats=[['Sales this month',amount(c.sales)],['Money received',amount(c.received)],['Outstanding balances',amount(c.outstanding)],['Expenses this month',amount(c.expenses)],['Orders this month',String(c.orders)],['Low stock alerts',String(c.lowStock.length)]];
 return <div className="tax-page"><p className="muted small">BUSINESS / OVERVIEW</p><h1>Your business overview</h1><p className="muted">Live records from your workspace. Financial amounts are operational indicators, not audited accounting profit.</p>
 <div className="grid grid-3">{stats.map(([label,value])=><section className="tax-panel" key={label}><p className="small muted">{label}</p><h2>{value}</h2></section>)}</div>
 <section className="tax-panel"><h2>Quick actions</h2><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><Link className="btn btn-primary" href="/orders/new">Create order</Link><Link className="btn" href="/customers/new">Add customer</Link><Link className="btn" href="/payments">View payments</Link><Link className="btn" href="/inventory">Inventory</Link><Link className="btn" href="/reports">Financial reports</Link></div></section>
 <div className="grid grid-2"><section className="tax-panel"><h2>Needs attention</h2>{insights.map(x=><p key={x.title}><strong>{x.title}</strong><br/><span className="muted small">{x.detail}</span> <Link href={x.href}>Review →</Link></p>)}</section><section className="tax-panel"><h2>Monthly comparison</h2><div className="table-wrap"><table className="table"><thead><tr><th>Metric</th><th>Previous</th><th>Current</th></tr></thead><tbody><tr><td>Sales</td><td>{amount(p.sales)}</td><td>{amount(c.sales)}</td></tr><tr><td>Payments received</td><td>{amount(p.received)}</td><td>{amount(c.received)}</td></tr><tr><td>Expenses</td><td>{amount(p.expenses)}</td><td>{amount(c.expenses)}</td></tr></tbody></table></div></section></div>
 <p className="muted small">Profit is available only after costs, adjustments and ledger postings are reconciled. No simulated figures are included.</p></div>
}
