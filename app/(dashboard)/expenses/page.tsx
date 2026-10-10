import {requireBusinessFeature} from '@/lib/server/authorization';
import {getWorkspace} from '@/lib/server/workspace';
import {money} from '@/lib/format';
import {ExpenseForm} from './expense-form';
export const dynamic='force-dynamic';
export default async function Expenses(){
 const {client,businessId,role}=await getWorkspace();
 const [expenses,access]=await Promise.all([
  client.from('expenses').select('id,description,amount,paid_at,expense_categories(name)').eq('business_id',businessId).order('paid_at',{ascending:false}).limit(200),
  requireBusinessFeature('expenses')
 ]);
 if(expenses.error)return <section className="tax-page"><h1>Expenses</h1><p role="alert">Expense records could not be loaded. Verify your workspace access.</p></section>;
 const rows=expenses.data||[],total=rows.reduce((v,e)=>v+Number(e.amount),0);
 const mayCreate=access.allowed&&['owner','manager','finance'].includes(role);
 return <div className="tax-page"><p className="small muted">BUSINESS / FINANCE</p><h1>Expenses</h1><p className="muted">Actual paid expenses recorded for your business. Accounting postings are tracked separately.</p>
 {mayCreate&&<ExpenseForm/>}
 <section className="tax-panel"><p className="small muted">Total of displayed {rows.length} records</p><h2>{money(total)}</h2></section>
 <section className="tax-panel"><h2>Expense register</h2><div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead><tbody>{rows.map(e=><tr key={e.id}><td>{new Date(e.paid_at).toLocaleDateString('en-NG')}</td><td>{Array.isArray(e.expense_categories)?e.expense_categories[0]?.name||'Uncategorised':(e.expense_categories as {name?:string}|null)?.name||'Uncategorised'}</td><td>{e.description}</td><td>{money(Number(e.amount))}</td></tr>)}</tbody></table></div>{!rows.length&&<p className="muted">No expenses recorded yet.</p>}{rows.length===200&&<p className="muted small">Latest 200 records shown. Totals are not full-period reports.</p>}</section></div>;
}
