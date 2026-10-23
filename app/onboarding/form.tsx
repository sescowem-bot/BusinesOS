'use client';
import {useActionState,useState} from 'react';
import {createWorkspace} from './actions';
import {nameFieldMessage} from '@/lib/form-experience';
import '@/components/form-experience.css';
export default function OnboardForm(){
 const [state,action,pending]=useActionState(createWorkspace,{error:''});
 const [businessName,setBusinessName]=useState('');const [touched,setTouched]=useState(false);
 const check=nameFieldMessage(businessName,2,120,'Business name');
 return <form action={action} className="bo-guided-form" style={{marginTop:20}}>
  <div className="bo-field"><label htmlFor="business_name">Business name</label>
   <input id="business_name" name="business_name" autoComplete="organization" value={businessName} onChange={e=>setBusinessName(e.target.value)} onBlur={()=>setTouched(true)} required minLength={2} maxLength={120} aria-invalid={touched&&!check.valid} aria-describedby="business-name-hint" placeholder="e.g. My Business Ventures"/>
   <p id="business-name-hint" className={'bo-field-hint'+(touched&&!check.valid?' bo-field-error':'')}>{touched&&!check.valid?check.message:'Use your customer-facing business name. You can change it later.'}</p></div>
  <div className="bo-field"><label htmlFor="category">Primary business activity</label>
   <select name="category" id="category" defaultValue="Retail" aria-describedby="category-hint"><option>Retail</option><option>Fashion</option><option>Food</option><option>Beauty</option><option>Professional Services</option><option>Manufacturing</option><option>Other</option></select>
   <p id="category-hint" className="bo-field-hint">Choose the closest match. This does not automatically register you for VAT.</p></div>
  <p className="bo-field-hint">You will start on the Free plan. Paid inventory and advanced tools are optional upgrades.</p>
  <div className="bo-form-actions"><button type="submit" className="btn btn-primary" disabled={pending||!check.valid}>{pending?'Creating your workspace…':'Create workspace'}</button></div>
  {state.error&&<p role="alert" className="bo-form-alert">{state.error}</p>}
 </form>;
}
