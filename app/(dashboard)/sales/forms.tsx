'use client';
import {useActionState} from 'react';
import {createCustomer,createOrder,recordPayment,type ActionState} from './actions';
import {useState} from 'react';
import {InitialPaymentFields} from '@/components/order-initial-payment';
const initial:ActionState={error:'',success:''};
function Result({value}:{value:ActionState}){return <div aria-live="polite">{value.error&&<p className="negative" role="alert">{value.error}</p>}{value.success&&<p style={{color:'#16845b'}}>{value.success}</p>}</div>}
const fieldStyle={width:'100%',padding:'10px 12px',border:'1px solid #d0d5dd',borderRadius:8,background:'#fff'};
const wrapStyle={display:'grid',gap:12,maxWidth:620};
export function CustomerForm(){const [state,action,pending]=useActionState(createCustomer,initial);return <form action={action} style={wrapStyle}><label>Customer name<input style={fieldStyle} name="name" required minLength={2} maxLength={150}/></label><label>Phone<input style={fieldStyle} name="phone" maxLength={40}/></label><label>Email<input style={fieldStyle} type="email" name="email" maxLength={254}/></label><button className="btn primary" disabled={pending}>{pending?'Saving…':'Save customer'}</button><Result value={state}/></form>}
export function OrderForm({customers,requestKey,canRecordCost=false}:{customers:{id:string;name:string}[];requestKey:string;canRecordCost?:boolean}){
 const[state,action,pending]=useActionState(createOrder,initial);
 const [quantity,setQuantity]=useState('1'),[unitPrice,setUnitPrice]=useState(''),[discount,setDiscount]=useState('0'),[delivery,setDelivery]=useState('0');
 const q=Number(quantity),price=Number(unitPrice),off=Number(discount),fee=Number(delivery);
 const canEstimate=quantity!==''&&unitPrice!==''&&[q,price,off,fee].every(Number.isFinite)&&q>0&&price>=0&&off>=0&&fee>=0&&off<=q*price;
 const total=canEstimate?Math.round((Math.round(q*price*100)/100-off+fee)*100)/100:null;
 return <form action={action} style={wrapStyle}>
  <input type="hidden" name="request_key" value={requestKey}/>
  <label>Customer<select required name="customer" style={fieldStyle} defaultValue=""><option value="">Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
  <label>Product or service description<input name="description" style={fieldStyle} minLength={2} maxLength={200} required/></label>
  <div className="form-grid"><label>Quantity<input type="number" name="quantity" value={quantity} onChange={e=>setQuantity(e.target.value)} min="0.001" step="0.001" style={fieldStyle} required/></label><label>Unit price (₦)<input type="number" name="unit_price" value={unitPrice} onChange={e=>setUnitPrice(e.target.value)} min="0" step="0.01" style={fieldStyle} required/></label></div>
  <div className="form-grid"><label>Discount (₦)<input type="number" name="discount" value={discount} onChange={e=>setDiscount(e.target.value)} min="0" step="0.01" style={fieldStyle}/></label><label>Delivery fee (₦)<input type="number" name="delivery" value={delivery} onChange={e=>setDelivery(e.target.value)} min="0" step="0.01" style={fieldStyle}/></label></div>
  {canRecordCost&&<label>Estimated item cost per unit (₦) — optional<input type="number" name="unit_cost" style={fieldStyle} min="0" step="0.01" placeholder="Enter verified cost if known"/><small className="muted">Restricted to owner, manager and finance. Leave blank if the actual cost is unknown; do not enter 0 to represent an unknown cost.</small></label>}
  <label>Expected delivery date<input type="date" name="due_date" style={fieldStyle}/></label>
  <p className="muted small">This form is for businesses without a reviewed, registered VAT profile. Registered VAT businesses must use the reviewed-tax form below.</p>
  <InitialPaymentFields estimatedTotal={total}/>
  <button className="btn primary" disabled={pending}>{pending?'Saving order and payment…':'Save order and payment'}</button><Result value={state}/>
 </form>;
}
export function PaymentForm({order,balance}:{order:string;balance:number}){const[state,action,pending]=useActionState(recordPayment,initial);return <form action={action} style={wrapStyle}><input type="hidden" name="order" value={order}/><label>Amount received (₦), maximum {balance.toFixed(2)}<input style={fieldStyle} type="number" name="amount" required min="0.01" max={balance} step="0.01"/></label><label>Payment method<select style={fieldStyle} name="method" required><option value="transfer">Bank transfer</option><option value="cash">Cash</option><option value="pos">POS</option><option value="card">Card, recorded manually</option><option value="other">Other</option></select></label><label>Reference (optional)<input name="reference" style={fieldStyle} maxLength={150}/></label><p className="muted small">Recording only. No payment gateway or online charge is made.</p><button className="btn primary" disabled={pending||balance<=0}>{pending?'Saving…':'Record payment'}</button><Result value={state}/></form>}
