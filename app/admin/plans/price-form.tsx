'use client';
import {useActionState} from 'react';
import {savePlanPrices,type PlanPriceState} from './price-actions';
const initialPlanPriceState:PlanPriceState={ok:false,message:''};
export function PlanPriceForm({id,name,monthly,annual}:{id:string;name:string;monthly:number|null|undefined;annual:number|null|undefined}){
 const [state,action,pending]=useActionState(savePlanPrices,initialPlanPriceState);
 return <form action={action} className="owner-plan-price-form">
  <input type="hidden" name="plan_id" value={id}/>
  <div className="owner-plan-price-heading"><strong>{name}</strong><span>{id==='free'?'Free forever':'Set the price customers see at checkout'}</span></div>
  <div className="owner-plan-price-inputs"><label>Monthly price (₦)<input type="number" name="monthly" step="0.01" min="0" defaultValue={id==='free'?'0':monthly??''} readOnly={id==='free'} placeholder="e.g. 7500"/></label><label>Annual price (₦)<input type="number" name="annual" step="0.01" min="0" defaultValue={id==='free'?'0':annual??''} readOnly={id==='free'} placeholder="e.g. 75000"/></label><button className="btn btn-primary" disabled={pending||id==='free'} type="submit">{pending?'Saving prices…':'Save prices'}</button></div>
  {state.message&&<p className={state.ok?'positive':'negative'} role="status">{state.message}</p>}
 </form>
}
