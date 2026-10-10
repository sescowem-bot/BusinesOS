'use client';
import {useActionState} from 'react';
import {createReviewedTaxOrder,type ReviewedTaxState} from './reviewed-tax-actions';
import {InitialPaymentFields} from '@/components/order-initial-payment';
import {useState} from 'react';
const initial:ReviewedTaxState={error:'',success:''};
export function ReviewedTaxForm({customers,supplies,requestKey}:{customers:Array<{id:string;name:string}>;supplies:Array<{id:string;name:string;treatment:string;rateBasisPoints:number}>;requestKey:string}){
 const [state,action,pending]=useActionState(createReviewedTaxOrder,initial);
 const [quantity,setQuantity]=useState('1'),[unitPrice,setUnitPrice]=useState(''),[discount,setDiscount]=useState('0'),[supplyId,setSupplyId]=useState('');
 const s=supplies.find(x=>x.id===supplyId);
 const q=Number(quantity),p=Number(unitPrice),off=Number(discount);
 const base=quantity!==''&&unitPrice!==''&&s&&[q,p,off].every(Number.isFinite)&&q>0&&p>=0&&off>=0&&off<=q*p?Math.round(q*p*100)/100-off:null;
 const estimatedTotal=base===null?null:Math.round((base+Math.round(base*(s?.rateBasisPoints||0)/10000*100)/100)*100)/100;
 return <form action={action} style={{display:'grid',gap:15}}>
  <input type="hidden" name="request_key" value={requestKey}/>
  <div className="form-grid">
   <label className="field">Customer<select name="customer" required defaultValue=""><option value="">Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <label className="field">Reviewed product / service<select name="tax_supply_id" required value={supplyId} onChange={e=>setSupplyId(e.target.value)}><option value="">Select approved supply</option>{supplies.map(s=><option key={s.id} value={s.id}>{s.name} · {s.treatment.replaceAll('_',' ')}</option>)}</select></label>
   <label className="field">Quantity<input type="number" name="quantity" value={quantity} onChange={e=>setQuantity(e.target.value)} step="0.001" min="0.001" required/></label>
   <label className="field">Unit price before VAT (₦)<input type="number" name="unit_price" value={unitPrice} onChange={e=>setUnitPrice(e.target.value)} min="0" step="0.01" required/></label>
   <label className="field">Discount before VAT (₦)<input type="number" name="discount" value={discount} onChange={e=>setDiscount(e.target.value)} min="0" step="0.01" required/></label>
   <label className="field">Payment due date<input type="date" name="due_date"/></label>
  </div>
  <p className="muted small">The tax rate is selected by the database from ONE approved supply rule effective on the transaction date. Delivery charges are not supported in this reviewed flow until their VAT classification is configured. This does not create a certified NRS e-invoice.</p>
  <InitialPaymentFields estimatedTotal={estimatedTotal}/>
  <button type="submit" className="btn btn-primary" disabled={pending}>{pending?'Saving reviewed order and payment…':'Save reviewed order and payment'}</button>
  {state.error&&<p role="alert" className="negative">{state.error}</p>}
  {state.success&&<p role="status" className="positive">{state.success}</p>}
 </form>;
}
