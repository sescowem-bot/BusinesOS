'use client';
import {useActionState,useMemo,useState,useEffect} from 'react';
import {createPurchase,createSupplier,receivePurchase,type PurchaseState} from './actions';
import {money} from '@/lib/format';
type Product={id:string;name:string;cost_price:number};
type Supplier={id:string;name:string};
const initial:PurchaseState={ok:false,message:''};
export function SupplierForm(){const [state,action,pending]=useActionState(createSupplier,initial);return <form className="comms-form" action={action}>
 <label>Supplier name<input name="name" minLength={2} maxLength={160} required/></label><label>Contact person<input name="contact" maxLength={160}/></label>
 <label>Phone<input name="phone" maxLength={50}/></label><label>Email<input type="email" name="email" maxLength={254}/></label>
 <label>Notes<textarea name="notes" maxLength={500}/></label><button className="btn btn-primary" disabled={pending}>{pending?'Saving…':'Save supplier'}</button>{state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}</form>}
export function PurchaseForm({suppliers,products}:{suppliers:Supplier[];products:Product[]}){
 const [state,action,pending]=useActionState(createPurchase,initial);
 const [lines,setLines]=useState<{product_id:string;quantity:number;unit_cost:number}[]>([]);
 const [product,setProduct]=useState(products[0]?.id||'');const [qty,setQty]=useState('1');const [cost,setCost]=useState(String(products[0]?.cost_price??0));
 const total=useMemo(()=>lines.reduce((sum,l)=>sum+l.quantity*l.unit_cost,0),[lines]);
 const add=()=>{const q=Number(qty),c=Number(cost);if(!product||!Number.isFinite(q)||q<=0||Math.abs(Math.round(q*1000)-q*1000)>1e-6||!Number.isFinite(c)||c<0||Math.abs(Math.round(c*100)-c*100)>1e-6)return;
 setLines(old=>old.some(x=>x.product_id===product)?old:old.length<30?[...old,{product_id:product,quantity:q,unit_cost:c}]:old)};
 return <form className="comms-form" action={action}><label>Supplier<select name="supplier" required><option value="">Select supplier</option>{suppliers.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
 <div className="bo-pos-add"><label>Product<select value={product} onChange={e=>{setProduct(e.target.value);setCost(String(products.find(p=>p.id===e.target.value)?.cost_price||0))}}><option value="">Choose product</option>{products.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label>Qty<input type="number" step="0.001" min="0.001" value={qty} onChange={e=>setQty(e.target.value)}/></label><label>Unit cost<input type="number" step="0.01" min="0" value={cost} onChange={e=>setCost(e.target.value)}/></label><button type="button" className="btn" onClick={add}>Add line</button></div>
 <div className="table-wrap"><table className="table"><thead><tr><th>Product</th><th>Quantity</th><th>Unit cost</th><th>Total</th><th></th></tr></thead><tbody>{lines.map(line=><tr key={line.product_id}><td>{products.find(x=>x.id===line.product_id)?.name}</td><td>{line.quantity}</td><td>{money(line.unit_cost)}</td><td>{money(line.unit_cost*line.quantity)}</td><td><button className="btn" type="button" onClick={()=>setLines(old=>old.filter(x=>x.product_id!==line.product_id))}>Remove</button></td></tr>)}</tbody></table></div>
 <p><strong>Order estimate: {money(total)}</strong></p><input type="hidden" name="lines" value={JSON.stringify(lines)}/><label>Notes<textarea name="notes" maxLength={500} placeholder="Supplier reference or receiving instructions"/></label>
 <button className="btn btn-primary" disabled={pending||!lines.length||!suppliers.length}>{pending?'Creating draft…':'Create draft purchase order'}</button>
 {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
 <p className="small muted">Drafts do not change stock or create accounts payable. Receive goods after physically checking quantities.</p>
 </form>;
}

export function ReceivePurchaseForm({purchaseId}:{purchaseId:string}){
 const [state,action,pending]=useActionState(receivePurchase,initial);
 return <form action={action} className="comms-form">
  <input type="hidden" name="purchase" value={purchaseId}/>
  <label className="small"><input type="checkbox" name="confirmed" value="yes" required/> I have physically checked the goods and quantities.</label>
  <button className="btn btn-primary" disabled={pending}>{pending?'Receiving…':'Confirm goods received'}</button>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}

// All quantities are confirmed in the database, not trusted from the browser.
import {receivePurchasePartial,recordSupplierBill,recordSupplierPayment} from './actions';
type OutstandingLine={id:string;product_name:string;ordered:number;received:number;remaining:number};
export function PartialReceiptForm({purchaseId,items}:{purchaseId:string;items:OutstandingLine[]}){
 const [state,action,pending]=useActionState(receivePurchasePartial,initial);
 const [request,setRequest]=useState('');
 const [qty,setQty]=useState<Record<string,string>>({});
 useEffect(()=>setRequest(crypto.randomUUID()),[]);
 useEffect(()=>{if(state.ok){setQty({});setRequest(crypto.randomUUID())}},[state.ok,state.message]);
 const selected=items.filter(i=>i.remaining>0&&Number(qty[i.id])>0).map(i=>({purchase_item_id:i.id,quantity:Number(qty[i.id])}));
 return <form action={action} className="comms-form bo-procurement-receipt">
  <input type="hidden" name="purchase" value={purchaseId}/><input type="hidden" name="request" value={request}/>
  <div className="table-wrap"><table className="table"><thead><tr><th>Product</th><th>Ordered</th><th>Received</th><th>Outstanding</th><th>Receive now</th></tr></thead><tbody>
   {items.map(i=><tr key={i.id}><td>{i.product_name}</td><td>{i.ordered}</td><td>{i.received}</td><td>{i.remaining}</td><td>{i.remaining>0?<input aria-label={`Quantity received for ${i.product_name}`} type="number" min="0" max={i.remaining} step="0.001" value={qty[i.id]??''} onChange={e=>setQty(o=>({...o,[i.id]:e.target.value}))} placeholder="0" style={{width:115}}/>:'Completed'}</td></tr>)}
  </tbody></table></div>
  <input type="hidden" name="lines" value={JSON.stringify(selected)}/>
  <label>Delivery note / inspection comments<textarea name="note" maxLength={500} placeholder="Supplier delivery note number or observations"/></label>
  <label className="small"><input name="confirmed" type="checkbox" value="yes" required/> I physically checked the quantities being received.</label>
  <button type="submit" className="btn btn-primary" disabled={!request||pending||!selected.length||selected.some(s=>s.quantity> (items.find(x=>x.id===s.purchase_item_id)?.remaining||0))}>{pending?'Recording…':'Record goods receipt'}</button>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
  <p className="small muted">Only received quantities increase company-wide stock. Use a different receipt for each supplier delivery. Reload to review the remaining balance.</p>
 </form>;
}
export function SupplierBillForm({purchases}:{purchases:{id:string;label:string}[]}){
 const [state,action,pending]=useActionState(recordSupplierBill,initial);
 return <form action={action} className="comms-form">
  <label>Received purchase order<select name="purchase" required><option value="">Choose purchase order</option>{purchases.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
  <label>Supplier invoice/reference<input name="reference" required maxLength={100}/></label>
  <label>Supplier invoice amount (NGN)<input name="amount" type="number" step="0.01" min="0.01" required/></label>
  <label>Invoice date<input name="issued" type="date" required/></label>
  <label>Due date (optional)<input name="due" type="date"/></label>
  <label>Notes<textarea name="note" maxLength={500}/></label>
  <button className="btn btn-primary" disabled={pending||!purchases.length}>{pending?'Saving…':'Record supplier bill'}</button>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
  <p className="small muted">Enter the supplier's actual invoice amount. Goods-received value alone does not establish a payable. No tax filing or GL posting is created here.</p>
 </form>;
}
export function SupplierPaymentForm({billId,outstanding}:{billId:string;outstanding:number}){
 const [state,action,pending]=useActionState(recordSupplierPayment,initial);
 const [request,setRequest]=useState('');
 useEffect(()=>setRequest(crypto.randomUUID()),[]);
 useEffect(()=>{if(state.ok)setRequest(crypto.randomUUID())},[state.ok,state.message]);
 return <form action={action} className="comms-form">
  <input type="hidden" name="bill" value={billId}/><input type="hidden" name="request" value={request}/>
  <label>Amount paid (NGN)<input name="amount" type="number" step="0.01" min="0.01" max={outstanding.toFixed(2)} required/></label>
  <label>Method<select name="method" required><option value="transfer">Bank transfer</option><option value="cash">Cash</option><option value="external_pos">External POS</option><option value="other">Other</option></select></label>
  <label>Payment reference<input name="reference" required minLength={3} maxLength={150}/></label>
  <label>Date paid<input name="paid" type="date" required/></label>
  <button className="btn btn-primary" disabled={pending||!request||outstanding<=0}>{pending?'Recording…':'Record confirmed payment'}</button>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
  <p className="small muted">Only record payments already verified outside BusinessOS. No bank transfer is initiated.</p>
 </form>;
}
