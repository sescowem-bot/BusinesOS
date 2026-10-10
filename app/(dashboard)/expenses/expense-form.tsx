'use client';
import {useActionState} from 'react';
import {createPaidExpense,type ExpenseResult} from './actions';
const empty:ExpenseResult={error:'',success:''};
export function ExpenseForm(){
 const [state,action,pending]=useActionState(createPaidExpense,empty);
 return <form action={action} className="tax-panel" style={{display:'grid',gap:12,maxWidth:620}}>
  <h2>Record a paid expense</h2>
  <p className="small muted">Record money actually paid. Unpaid supplier bills and accruals require a separate workflow.</p>
  <label>Description <input name="description" required minLength={3} maxLength={300} placeholder="Office internet subscription"/></label>
  <label>Amount <input name="amount" type="number" min="0.01" max="999999999" step="0.01" required/></label>
  <label>Date paid (UTC accounting date) <input name="paid_on" type="date" required/></label>
  <button className="btn primary" disabled={pending}>{pending?'Saving…':'Record expense'}</button>
  <p aria-live="polite" role={state.error?'alert':'status'} className={state.error?'negative':'small muted'}>{state.error||state.success}</p>
 </form>;
}
