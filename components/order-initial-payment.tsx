'use client';
import {useState} from 'react';

export type InitialPaymentSelection='unpaid'|'partial'|'paid';
export function InitialPaymentFields({estimatedTotal}:{estimatedTotal:number|null}){
 const [status,setStatus]=useState<InitialPaymentSelection>('unpaid');
 const [amount,setAmount]=useState('');
 const safeTotal=estimatedTotal!==null&&Number.isFinite(estimatedTotal)?Math.max(0,estimatedTotal):null;
 const part=Number(amount||0);
 const display=(n:number)=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(n);
 const paidPreview=status==='paid'?(safeTotal??0):status==='partial'?(Number.isFinite(part)?part:0):0;
 const balance=safeTotal===null?null:Math.max(0,safeTotal-paidPreview);
 return <fieldset className="bo-initial-payment" aria-describedby="order-payment-help">
  <legend>Payment on this order</legend>
  <p id="order-payment-help" className="muted small">Choose what the customer has actually paid. Do not mark a transfer as received until you have verified it.</p>
  <div className="bo-payment-choice" role="radiogroup" aria-label="Initial payment status">
   {([{id:'unpaid',label:'Not paid',description:'Save the full balance due'},
      {id:'partial',label:'Part payment',description:'Record an amount received'},
      {id:'paid',label:'Paid in full',description:'Record the exact order total'}] as const).map(option=><label key={option.id} className={status===option.id?'selected':''}>
    <input type="radio" name="payment_state" value={option.id} checked={status===option.id} onChange={()=>setStatus(option.id)}/>
    <span><strong>{option.label}</strong><small>{option.description}</small></span>
   </label>)}
  </div>
  {status==='partial'&&safeTotal!==null&&Number.isFinite(part)&&part>=safeTotal&&<p className="negative" role="alert">The amount entered is equal to or above the estimated balance. Choose “Paid in full” if the customer has settled everything.</p>}
  <input type="hidden" name="payment_amount" value={status==='partial'?amount:'0'}/>
  {status==='partial'&&<label className="field">Amount already received (₦)
    <input aria-label="Amount received" type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} required/>
   </label>}
  {status!=='unpaid'&&<div className="form-grid">
   <label className="field">Payment method<select name="payment_method" required defaultValue="transfer">
     <option value="transfer">Bank transfer (verified)</option><option value="cash">Cash</option>
     <option value="pos">External POS terminal (record only)</option><option value="card">Card (record only)</option><option value="other">Other</option>
    </select></label>
   <label className="field">Payment reference (optional)<input name="payment_reference" maxLength={150} placeholder="Transfer reference or receipt number"/></label>
  </div>}
  <div className="bo-payment-preview" aria-live="polite">
   <div><span>Estimated total</span><strong>{safeTotal===null?'Calculated securely when saved':display(safeTotal)}</strong></div>
   <div><span>Initial payment</span><strong>{status==='paid'&&safeTotal===null?'Full calculated amount':display(paidPreview)}</strong></div>
   <div><span>Estimated outstanding</span><strong>{balance===null?'Shown after saving':display(balance)}</strong></div>
  </div>
  <p className="muted small">All figures are confirmed from the saved order by the database, including reviewed VAT. This records a payment received; it does not move money.</p>
 </fieldset>;
}
