'use client';
import {useActionState,useState} from 'react';
import {saveWholesaleTier,removeWholesaleTier,type WholesaleState} from './actions';
const initial:WholesaleState={ok:false,message:''};
type Product={id:string;name:string;sku:string|null;selling_price:number};
function Message({state}:{state:WholesaleState}){return state.message?<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>:null;}
export function PriceTierForm({products}:{products:Product[]}){
 const [state,action,pending]=useActionState(saveWholesaleTier,initial);
 const [term,setTerm]=useState('');const [id,setId]=useState('');
 const filtered=products.filter(p=>`${p.name} ${p.sku||''}`.toLowerCase().includes(term.toLowerCase())).slice(0,25);
 const selected=products.find(p=>p.id===id);
 return <form className="comms-form" action={action}>
  <label>Find product<input type="search" placeholder="Search name or SKU" value={term} onChange={e=>{setTerm(e.target.value);setId('')}}/></label>
  <label>Product<select required name="product" value={id} onChange={e=>setId(e.target.value)}><option value="">Choose a product</option>{filtered.map(p=><option key={p.id} value={p.id}>{p.name} · ₦{Number(p.selling_price).toFixed(2)}</option>)}</select></label>
  {selected&&<p className="small muted">Current retail price: ₦{Number(selected.selling_price).toFixed(2)}. Enter a lower reference unit price for wholesale orders.</p>}
  <label>Minimum purchase quantity<input required type="number" name="quantity" step="0.001" min="2" defaultValue="10"/></label>
  <label>Suggested wholesale unit price (₦)<input required type="number" name="price" step="0.01" min="0.01" max={selected?.selling_price} placeholder="0.00"/></label>
  <label>Internal note (optional)<input name="note" maxLength={250} placeholder="e.g. carton order pricing"/></label>
  <button className="btn btn-primary" disabled={pending||!id}>{pending?'Saving…':'Save price tier'}</button><Message state={state}/>
 </form>;
}
export function DeleteTierForm({tier}:{tier:string}){
 const [state,action,pending]=useActionState(removeWholesaleTier,initial);
 return <form action={action} className="bo-wholesale-delete"><input type="hidden" name="tier" value={tier}/><label><input type="checkbox" name="confirm" value="yes" required/> Confirm remove</label><button className="btn" disabled={pending}>{pending?'Removing…':'Remove'}</button><Message state={state}/></form>;
}
