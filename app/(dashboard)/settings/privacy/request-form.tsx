'use client';
import {useActionState} from 'react';
import {submitPrivacyRequest,type PrivacyRequestState} from './actions';
const initial:PrivacyRequestState={ok:false,message:''};
export function PrivacyRightsForm({owner}:{owner:boolean}){
 const [state,action,pending]=useActionState(submitPrivacyRequest,initial);
 return <form action={action} className="comms-form">
  <label>What do you need?
   <select name="kind" required defaultValue="access">
    <option value="access">Access or obtain a copy of personal data</option>
    <option value="correction">Correct inaccurate personal information</option>
    <option value="portability">Request a portable copy of data</option>
    <option value="deletion">Request deletion or account closure</option>
    <option value="restriction">Restrict certain processing</option>
    <option value="objection">Object to processing</option>
    <option value="consent">Withdraw or review consent</option>
    <option value="other">Other privacy concern</option>
   </select>
  </label>
  <label>Data concerned
   <select name="scope" defaultValue="mine">
    <option value="mine">My account data</option>
    {owner&&<option value="business">My business records</option>}
   </select>
  </label>
  <label>Describe the request
   <textarea name="details" minLength={10} maxLength={2000} rows={5} required placeholder="Tell us what you'd like help with. Don't include passwords or card details."/>
  </label>
  <p className="small muted">We'll check your identity before taking action. Some records may need to be kept for legal or accounting reasons.</p>
  <button className="btn btn-primary" type="submit" disabled={pending}>{pending?'Submitting…':'Send privacy request'}</button>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}
