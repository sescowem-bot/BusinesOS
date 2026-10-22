'use client';
import {useActionState,useState} from 'react';
import {reviewClosureRequest,type ReviewState} from './actions';
const initial:ReviewState={ok:false,message:''};
export function ClosureReviewForm({requestId}:{requestId:string}){
 const [state,action,pending]=useActionState(reviewClosureRequest,initial);
 const [status,setStatus]=useState('under_review');
 const approving=status==='approved_for_processing';
 return <form action={action} className="comms-form">
  <input type="hidden" name="request_id" value={requestId}/>
  <label>Decision<select name="status" value={status} onChange={e=>setStatus(e.target.value)}>
   <option value="under_review">Under review</option>
   <option value="verification_required">More identity verification required</option>
   <option value="approved_for_processing">Approved for manual processing (not erased)</option>
   <option value="declined">Declined</option>
  </select></label>
  {approving&&<fieldset style={{padding:12,border:'1px solid #d4dce2',borderRadius:8}}>
   <legend>Confirm evidence before approval</legend>
   <label><input type="checkbox" name="identity" value="yes" required/> Identity confirmed independently</label>
   <label><input type="checkbox" name="retention" value="yes" required/> Retention obligations reviewed</label>
   <label><input type="checkbox" name="payments" value="yes" required/> Outstanding payments and subscriptions reviewed</label>
   <label><input type="checkbox" name="exports" value="yes" required/> Data export considered</label>
  </fieldset>}
  <label>Decision note<textarea name="review_note" rows={4} minLength={approving?20:15} maxLength={1200} required
    placeholder="Explain your decision and next steps. Avoid sensitive personal information."/></label>
  <p className="small muted">This records a decision only. No customer records or login accounts are deleted here.</p>
  <button type="submit" className="btn btn-primary" disabled={pending}>{pending?'Saving…':'Record decision'}</button>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}
