'use client';
import {useActionState} from 'react';
import {registerReviewedPolicy,type LegalApprovalState} from './actions';
const initial:LegalApprovalState={ok:false,message:''};
export function LegalPublicationForm(){
 const [state,action,pending]=useActionState(registerReviewedPolicy,initial);
 return <form action={action} className="comms-form">
  <label>Reviewed document
   <select name="document_key" defaultValue="terms">
    <option value="terms">Terms of Service</option>
    <option value="privacy">Privacy Notice</option>
    <option value="cookies">Cookie Notice</option>
   </select>
  </label>
  <label>Approved version<input name="version" placeholder="e.g. 1.0" required maxLength={60} pattern="[-A-Za-z0-9.]+"/></label>
  <label>Real legal-review evidence / reference
   <textarea name="review_reference" rows={3} required minLength={8} maxLength={500} placeholder="Reviewer name or approved review reference; do not invent an approval."/>
  </label>
  <label className="bo-legal-choice">
   <input name="review_confirm" type="checkbox" required/>
   <span>I confirm a qualified reviewer has approved the exact document now published in the website CMS, and that I am authorised to record this approval on behalf of the operator.</span>
  </label>
  <p className="small muted">Registering a version is permanent evidence. Future changes require a new legal review and version. This form does not obtain regulatory approval or publish a draft document for you.</p>
  <button type="submit" className="btn btn-primary" disabled={pending}>{pending?'Registering…':'Record reviewed policy version'}</button>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}
