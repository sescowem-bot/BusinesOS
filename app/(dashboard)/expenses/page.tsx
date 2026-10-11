import {Suspense} from 'react';
import Link from 'next/link';
import {getWorkspace} from '@/lib/server/workspace';
import {ExpenseForm} from './expense-form';
import {WorkspaceLoadingBrand} from '@/components/workspace-loading-brand';

export const dynamic='force-dynamic';
const PAGE_SIZE=25;
type PageSearch={page?:string|string[]};

/** Expense amount presentation is exact to the kobo; ordinary money() rounds to naira. */
const naira=(amount:number)=>new Intl.NumberFormat('en-NG',{
 style:'currency',currency:'NGN',minimumFractionDigits:2,maximumFractionDigits:2
}).format(amount);

function RegisterLoading(){
 return <section className="tax-panel bo-expense-register" role="status" aria-live="polite" aria-busy="true">
  <div className="bo-expense-registry-head"><div><h2>Expense register</h2><p className="small muted">Loading the latest expense records…</p></div></div>
  <WorkspaceLoadingBrand label="Loading expense records" mode="section"/>
 </section>;
}

function WorkspaceLoading(){
 return <section className="bo-expense-workspace-loading" role="status" aria-live="polite" aria-busy="true">
  <WorkspaceLoadingBrand label="Preparing your expenses" mode="section"/>
 </section>;
}

/** Paginated, tenant-scoped financial records. Do not fetch or cache all expenses in memory. */
async function ExpenseRegister({page}:{page:number}){
 const {client,businessId}=await getWorkspace();
 const start=(page-1)*PAGE_SIZE;
 const {data,error}=await client.from('expenses')
  .select('id,description,amount,paid_at,expense_categories(name)')
  .eq('business_id',businessId)
  .order('paid_at',{ascending:false})
  .order('id',{ascending:false})
  .range(start,start+PAGE_SIZE);
 if(error)return <section className="tax-panel bo-expense-register" role="alert">
  <h2>Expenses are temporarily unavailable</h2>
  <p>We couldn't load the register. Your existing expense records haven't been changed.</p>
  <p className="bo-expense-actions"><a className="btn" href="/expenses">Try again</a><Link href="/support">Contact support</Link></p>
 </section>;
 const rows=(data||[]).slice(0,PAGE_SIZE),hasNext=(data||[]).length>PAGE_SIZE;
 const pageTotal=rows.reduce((v,e)=>v+Number(e.amount),0);
 return <section className="tax-panel bo-expense-register" aria-label="Recent expenses">
  <div className="bo-expense-registry-head">
   <div><h2>Expense register</h2><p className="small muted">Showing up to {PAGE_SIZE} records per page, newest first. Amounts shown below are paid expenses only.</p></div>
   <div className="bo-expense-page-total"><span>Total on this page</span><strong>{naira(pageTotal)}</strong></div>
  </div>
  <div className="table-wrap bo-expense-table"><table className="table"><thead><tr><th>Date paid</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead><tbody>
   {rows.map(e=><tr key={e.id}>
    <td data-label="Date paid">{new Date(e.paid_at).toLocaleDateString('en-NG')}</td>
    <td data-label="Category">{Array.isArray(e.expense_categories)?e.expense_categories[0]?.name||'Uncategorised':(e.expense_categories as {name?:string}|null)?.name||'Uncategorised'}</td>
    <td data-label="Description">{e.description}</td>
    <td data-label="Amount"><strong>{naira(Number(e.amount))}</strong></td>
   </tr>)}
  </tbody></table></div>
  {!rows.length&&<div className="bo-expense-empty"><strong>{page===1?'No paid expenses recorded yet.':'There are no expenses on this page.'}</strong><p className="small muted">{page===1?'When you save an expense, it will appear here.':'Return to the previous page to review earlier records.'}</p></div>}
  <nav className="bo-expense-pagination" aria-label="Expense pages">
   <span className="small muted">Page {page} · Only displayed records are totalled</span>
   <div>{page>1&&<Link className="btn" href={page===2?'/expenses':`/expenses?page=${page-1}`} prefetch={false}>← Previous</Link>}{hasNext&&<Link className="btn" href={`/expenses?page=${page+1}`} prefetch={false}>Next page →</Link>}</div>
  </nav>
 </section>;
}

async function ExpenseWorkspace({searchParams}:{searchParams:Promise<PageSearch>}){
 const [{role},search]=await Promise.all([getWorkspace(),searchParams]);
 const raw=Array.isArray(search.page)?search.page[0]:search.page;
 const parsed=raw&&/^\d{1,4}$/.test(raw)?Number(raw):1;
 const page=Number.isSafeInteger(parsed)&&parsed>0?Math.min(parsed,1000):1;
 const mayCreate=['owner','manager','finance'].includes(role);
 return <>
  {mayCreate&&<ExpenseForm/>}
  <Suspense key={`expense-register-${page}`} fallback={<RegisterLoading/>}><ExpenseRegister page={page}/></Suspense>
 </>;
}

/** Static page introduction streams immediately; authenticated data remains private. */
export default function Expenses({searchParams}:{searchParams:Promise<PageSearch>}){
 return <div className="tax-page bo-expenses-page">
  <p className="small muted">BUSINESS / FINANCE</p>
  <h1>Expenses</h1>
  <p className="muted">Record expenses you've actually paid, then review them in manageable pages. Unpaid supplier bills are handled separately.</p>
  <Suspense fallback={<WorkspaceLoading/>}><ExpenseWorkspace searchParams={searchParams}/></Suspense>
 </div>;
}
