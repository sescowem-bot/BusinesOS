'use client';
import {useActionState,useEffect,useState} from 'react';
import Link from 'next/link';
import {requestPosReturn,reviewPosReturn,completePosReturn,type ReturnActionState} from './actions';
import {money} from '@/lib/format';
const initial:ReturnActionState={ok:false,message:''};
type EligibleItem={orderId:string;orderNumber:string;id:string;name:string;quantity:number;unitPrice:number};
export function RequestReturnForm({items}:{items:EligibleItem[]}){
 const [state,action,pending]=useActionState(requestPosReturn,initial);
 const [selected,setSelected]=useState(items[0]?`${items[0].orderId}:${items[0].id}`:'');
 const [requestId,setRequestId]=useState('');
 useEffect(()=>setRequestId(crypto.randomUUID()),[]);
 useEffect(()=>{if(state.ok)setRequestId(crypto.randomUUID())},[state]);
 const chosen=items.find(i=>`${i.orderId}:${i.id}`===selected);
 return <form className="comms-form" action={action}>
  <input type="hidden" name="request_id" value={requestId}/><input type="hidden" name="order" value={chosen?.orderId||''}/><input type="hidden" name="item" value={chosen?.id||''}/>
  <label>Original POS sale item<select value={selected} onChange={e=>setSelected(e.target.value)} required>
   {items.map(i=><option key={i.id} value={`${i.orderId}:${i.id}`}>{i.orderNumber} · {i.name} · sold {i.quantity}</option>)}
  </select></label>
  {chosen&&<p className="small muted">Originally sold: {chosen.quantity} × {money(chosen.unitPrice)}. Available return quantity is verified from completed returns by the database.</p>}
  <label>Quantity to return<input type="number" name="quantity" min="0.001" max={chosen?.quantity||1000000} step="0.001" required defaultValue="1"/></label>
  <label>Reason for return<textarea name="reason" required minLength={10} maxLength={500} rows={3} placeholder="Describe the product condition and why it is being returned."/></label>
  <p className="small muted">Only fully paid POS sales without delivery charges are supported in this phase. No stock or payment is changed by a request.</p>
  <button disabled={pending||!requestId||!chosen} type="submit" className="btn btn-primary">{pending?'Submitting…':'Request return'}</button>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
  {state.returnId&&<Link href={`/returns/${state.returnId}`} className="btn">Open return</Link>}
 </form>;
}
export function ReturnReviewForm({returnId}:{returnId:string}){
 const [state,action,pending]=useActionState(reviewPosReturn,initial);
 return <form action={action} className="comms-form"><input type="hidden" name="return_id" value={returnId}/>
  <label>Decision<select name="decision" required><option value="approve">Approve return</option><option value="reject">Reject return</option></select></label>
  <label>Review note (optional)<textarea name="note" maxLength={500} rows={2}/></label>
  <label className="bo-checkbox"><input type="checkbox" name="review_confirm" value="yes" required/> I have checked the sale, customer return and recorded amount.</label>
  <button className="btn btn-primary" disabled={pending}>{pending?'Saving review…':'Record decision'}</button>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}
export function ReturnCompleteForm({returnId,amount}:{returnId:string;amount:number}){
 const [state,action,pending]=useActionState(completePosReturn,initial);
 return <form action={action} className="comms-form"><input type="hidden" name="return_id" value={returnId}/>
  <p><strong>Confirm refunded amount: {money(amount)}</strong></p>
  <p className="small muted">First refund the customer outside BusinessOS, then record the verified payment here. This form does not move money.</p>
  <label>Actual refund method<select name="method" required><option value="cash">Cash paid back</option><option value="transfer">Bank transfer confirmed</option><option value="external_pos">External POS reversal confirmed</option><option value="external_card">External card refund confirmed</option><option value="other">Other documented refund</option></select></label>
  <label>Refund reference (required)<input name="reference" required minLength={3} maxLength={150} placeholder="Cash voucher, refund receipt or transfer ID"/></label>
  <label>Returned stock disposition<select name="restock" required><option value="no">Do not restore saleable stock</option><option value="yes">Verified saleable — restore tracked stock</option></select></label>
  <label className="bo-checkbox"><input type="checkbox" name="confirmed" value="yes" required/> I independently verified the completed refund and item condition, and understand this action cannot be undone here.</label>
  <button className="btn btn-primary" disabled={pending}>{pending?'Recording…':'Record refund and issue credit note'}</button>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
  {state.creditNoteId&&<Link className="btn" href={`/returns/credit-notes/${state.creditNoteId}`}>View issued credit note</Link>}
 </form>;
}
