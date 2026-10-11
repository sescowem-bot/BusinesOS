'use client';
import Link from 'next/link';
/** Scoped error boundary: a failed expense read must not break the entire workspace. */
export default function ExpensesError({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <div className="tax-page bo-expenses-page" role="alert">
  <p className="small muted">BUSINESS / FINANCE</p><h1>Expenses couldn't open</h1>
  <p>There was a problem loading this page. Your saved records haven't been changed.</p>
  <div className="bo-expense-actions"><button className="btn primary" type="button" onClick={()=>reset()}>Try loading again</button><Link href="/dashboard" className="btn">Back to dashboard</Link><Link href="/support">Contact support</Link></div>
 </div>;
}
