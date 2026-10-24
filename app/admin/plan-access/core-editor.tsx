'use client';
import {useActionState} from 'react';
import {saveCoreAccess,type CoreAccessState} from './core-actions';
import {essentialCapabilities} from '@/lib/plan-catalog';
const initial:CoreAccessState={ok:false,message:''};
function OneCore({plan,feature,enabled}:{plan:string;feature:typeof essentialCapabilities[number];enabled:boolean}){
 const [state,action,pending]=useActionState(saveCoreAccess,initial);
 return <form action={action} className="plan-feature-row" style={{alignItems:'center',gap:12}}>
  <input type="hidden" name="plan" value={plan}/><input type="hidden" name="feature" value={feature.key}/>
  <input type="hidden" name="enabled" value={enabled?'false':'true'}/>
  <div className="plan-feature-description"><strong>{feature.name}</strong><p className="small muted">{feature.detail}</p></div>
  <div className="plan-feature-controls"><strong>{enabled?'Allowed':'Not allowed'}</strong>
   <button className="btn" type="submit" disabled={pending}>{pending?'Saving…':enabled?'Disable':'Allow'}</button>
   {state.message&&<p className="small" role={state.ok?'status':'alert'}>{state.message}</p>}
  </div>
 </form>;
}
export function CorePlanAccessEditor({plan,values}:{plan:string;values:Record<string,boolean>}){
 return <section className="card card-pad" style={{marginBottom:16}}><h3>Core features — configure for this plan</h3><p className="small muted">Every core feature can be allowed or denied independently. New businesses inherit the settings for their subscription. Business owners retain essential account administration to avoid lockout.</p>
 <div className="plan-permissions-list">{essentialCapabilities.map(feature=><OneCore key={plan+feature.key} plan={plan} feature={feature} enabled={values[feature.key]??true}/>)}</div>
 </section>;
}
