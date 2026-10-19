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
    {owner&&<option value="business">Records held for my business workspace</option>}
   </select>
  </label>
  <label>Describe the request
   <textarea name="details" minLength={10} maxLength={2000} rows={5} required placeholder="Explain which records or processing you mean. Never include passwords, tokens or payment card details."/>
  </label>
  <p className="small muted">Submitting a request does not automatically delete legal or financial records. We verify identity, examine applicable legal obligations and explain the outcome. For data your business controls about its own customers, your business remains responsible for its lawful handling.</p>
  <button className="btn btn-primary" type="submit" disabled={pending}>{pending?'Submitting…':'Send privacy request'}</button>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}
