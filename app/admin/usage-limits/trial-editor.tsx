'use client';
import {useActionState} from 'react';
import {setTrialModule,issueModuleTrial,type TrialState} from './trial-actions';
import {releasedPaidCapabilities} from '@/lib/plan-catalog';
const initial:TrialState={ok:false,message:''};
export function TrialModuleSettings({plan,enabledKeys}:{plan:string;enabledKeys:string[]}){
 const [state,action,pending]=useActionState(setTrialModule,initial);
 return <form action={action} style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'end',marginTop:12}}>
 <input type="hidden" name="plan" value={plan}/>
 <label>Trial module<select name="feature">{releasedPaidCapabilities.map(f=><option key={f.key} value={f.key}>{f.name}</option>)}</select></label>
 <label><input type="checkbox" name="enabled"/> Offer this module</label>
 <button className="btn" disabled={pending}>Save module</button>
 {state.message&&<p role={state.ok?'status':'alert'} className="small">{state.message}</p>}
 <p className="small muted">Currently eligible: {enabledKeys.length?enabledKeys.map(k=>releasedPaidCapabilities.find(x=>x.key===k)?.name||k).join(', '):'No modules enabled'}.</p>
 </form>;
}
export function IssueModuleTrial({business,options}:{business?:string;options:{plan:string;feature:string;label:string}[]}){
 const [state,action,pending]=useActionState(issueModuleTrial,initial);
 return <form action={action} className="card card-pad" style={{margin:'16px 0',display:'grid',gap:12}}>
  <h3>Give a business trial access</h3><p className="small muted">Select an approved offer. It is free, time-limited, and does not change the customer's subscription. A module cannot be trialled repeatedly by the same business.</p>
  <label>Business ID<input name="business" required defaultValue={business||''} placeholder="Select a business from its profile" /></label>
  <label>Trial offer<select name="offer" required>{options.map(o=><option key={o.plan+'::'+o.feature} value={o.plan+'::'+o.feature}>{o.label}</option>)}</select></label>
  <button className="btn btn-primary" disabled={pending||!options.length}>Issue trial</button>
  {state.message&&<p role={state.ok?'status':'alert'}>{state.message}</p>}
 </form>;
}
