'use client';
import {useActionState} from 'react';
import {saveLimit,saveTrial,type LimitState} from './actions';
const initial:LimitState={ok:false,message:''};
export function LimitEditor({plan,metric,value}:{plan:string;metric:string;value:number|null}){
 const [state,action,pending]=useActionState(saveLimit,initial);
 return <form action={action} className="bo-limits-editor">
  <input type="hidden" name="plan" value={plan}/><input type="hidden" name="metric" value={metric}/>
  <label className="sr-only" htmlFor={'limit-'+plan+'-'+metric}>Limit for {plan} {metric}</label>
  <input id={'limit-'+plan+'-'+metric} name="count" type="number" inputMode="numeric" min={0} max={999999999} step={1} required defaultValue={value??''} placeholder="Quantity"/>
  <label className="sr-only" htmlFor={'why-'+plan+'-'+metric}>Reason for change</label>
  <input id={'why-'+plan+'-'+metric} name="reason" minLength={12} maxLength={300} required placeholder="Reason for change"/>
  <button type="submit" className="btn" disabled={pending}>{pending?'Saving…':'Save'}</button>
  {state.message&&<p role={state.ok?'status':'alert'} className="small">{state.message}</p>}
 </form>;
}
export function TrialEditor({plan,days,enabled}:{plan:string;days:number;enabled:boolean}){
 const [state,action,pending]=useActionState(saveTrial,initial);
 return <form action={action} className="bo-limits-trial">
  <input name="plan" type="hidden" value={plan}/>
  <label>Trial duration (days)<input name="days" type="number" inputMode="numeric" min={0} max={30} step={1} defaultValue={days} required/></label>
  <label><input name="enabled" type="checkbox" defaultChecked={enabled}/> Preferred trial offer</label>
  <button type="submit" className="btn" disabled={pending}>{pending?'Saving…':'Save trial preference'}</button>
  {state.message&&<p role={state.ok?'status':'alert'} className="small">{state.message}</p>}
 </form>;
}
