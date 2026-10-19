'use client';
import {useActionState} from 'react';
import {reviewPrivacyRequest,type ReviewPrivacyState} from './actions';
const initial:ReviewPrivacyState={ok:false,message:''};
export function ReviewPrivacyForm({id}:{id:string}){
 const [state,action,pending]=useActionState(reviewPrivacyRequest,initial);
 return <form className="comms-form" action={action}>
  <input type="hidden" name="id" value={id}/>
  <label>Review status<select name="status" defaultValue="reviewing">
   <option value="reviewing">Reviewing</option><option value="verification_required">Identity verification required</option>
   <option value="completed">Completed</option><option value="declined">Declined with explanation</option>
  </select></label>
  <label>Message to requester<textarea name="response" minLength={5} maxLength={2000} required rows={3} placeholder="What was reviewed, what happens next and any applicable exceptions. Do not copy private documents here."/></label>
  <p className="small muted">Marking completed only records a review outcome. It does not erase data, export records or notify regulators automatically.</p>
  <button className="btn btn-primary" type="submit" disabled={pending}>{pending?'Saving…':'Save response'}</button>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}
