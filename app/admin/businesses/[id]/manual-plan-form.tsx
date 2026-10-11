'use client';
import {useActionState} from 'react';
import {setManualBusinessPlan} from './manual-plan-actions';
export function ManualPlanForm({businessId,planId,plans}:{businessId:string;planId:string|null;plans:{id:string;name:string}[]}){
 const [state,action,pending]=useActionState(setManualBusinessPlan,{ok:false,message:''});
 return <form action={action} className="comms-form">
  <input type="hidden" name="business" value={businessId}/>
  <label>Assign subscription<select name="plan" required defaultValue={planId||'free'}>{plans.map(plan=><option value={plan.id} key={plan.id}>{plan.name}</option>)}</select></label>
  <label>Access ends (optional)<input type="date" name="expires"/></label>
  <label>Reason for change<textarea name="reason" required minLength={12} maxLength={500} rows={3} placeholder="Courtesy upgrade for a 30-day pilot, agreed with the business owner"/></label>
  <p className="small muted">Administrative assignment only. No Paystack charge is made. Existing paid access can be replaced, so confirm the business and plan before saving.</p>
  <button className="btn btn-primary" disabled={pending} type="submit">{pending?'Updating…':'Update this business subscription'}</button>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}
