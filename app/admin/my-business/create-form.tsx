'use client';
import {useActionState} from 'react';
import {createMyBusiness} from './actions';

export function CreateMyBusinessForm(){
 const [state,action,pending]=useActionState(createMyBusiness,{error:''});
 return <form action={action} className="owner-business-form">
  <div className="field"><label htmlFor="owner-business-name">Business name</label><input id="owner-business-name" name="business_name" required minLength={2} maxLength={120} placeholder="e.g. My Studio"/></div>
  <div className="field"><label htmlFor="owner-business-category">Business activity</label><select id="owner-business-category" name="category"><option>Professional Services</option><option>Retail</option><option>Fashion</option><option>Food</option><option>Beauty</option><option>Manufacturing</option><option>Other</option></select></div>
  <button type="submit" className="btn btn-primary" disabled={pending}>{pending?'Creating your business…':'Create my business workspace'}</button>
  {state.error&&<p role="alert" className="negative small">{state.error}</p>}
 </form>;
}
