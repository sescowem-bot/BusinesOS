'use client';
import {useActionState,useState} from 'react';
import {submitClosureRequest,type ClosureRequestState} from './actions';
const initial:ClosureRequestState={ok:false,message:''};
type Business={business_id:string;name:string};
export function ClosureRequestForm({businesses}:{businesses:Business[]}){
 const [state,action,pending]=useActionState(submitClosureRequest,initial);
 const [kind,setKind]=useState('personal_account_erasure');
 return <form action={action} className="comms-form">
  <label>Request type<select name="request_type" value={kind} onChange={e=>setKind(e.target.value)}>
   <option value="personal_account_erasure">Request deletion of my personal account</option>
   <option value="business_closure" disabled={!businesses.length}>Request closure of a business I own</option>
  </select></label>
  {kind==='business_closure'&&<label>Business<select name="business_id" required defaultValue="">
   <option value="">Select a business you own</option>
   {businesses.map(b=><option value={b.business_id} key={b.business_id}>{b.name}</option>)}
  </select></label>}
  <label>Reason<textarea name="reason" rows={4} minLength={15} maxLength={1000} required
   placeholder="Explain what you would like reviewed. Do not enter passwords or bank card information."/></label>
  <p className="small muted">This is a request, not immediate deletion. We will verify ownership and identity, review required record retention and check outstanding subscription matters.</p>
  <button type="submit" className="btn btn-primary" disabled={pending}>{pending?'Submitting…':'Submit for review'}</button>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}
