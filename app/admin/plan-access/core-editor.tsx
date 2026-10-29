'use client';
import {useActionState} from 'react';
import {saveCoreAccess,type CoreAccessState} from './core-actions';
import {essentialCapabilities} from '@/lib/plan-catalog';
const initial:CoreAccessState={ok:false,message:''};
function OneCore({plan,feature,enabled}:{plan:string;feature:typeof essentialCapabilities[number];enabled:boolean}){
 const [state,action,pending]=useActionState(saveCoreAccess,initial);
 return <form action={action} className="bo-core-feature-row">
  <input type="hidden" name="plan" value={plan}/><input type="hidden" name="feature" value={feature.key}/>
  <input type="hidden" name="enabled" value={enabled?'false':'true'}/>
  <div><strong>{feature.name}</strong><p>{feature.detail}</p></div>
  <div className="bo-core-feature-action"><span className={enabled?'bo-core-allowed':'bo-core-disabled'}>{enabled?'Allowed':'Disabled'}</span><button className="btn" type="submit" disabled={pending} aria-label={(enabled?'Disable ':'Allow ')+feature.name+' for '+plan}>{pending?'Saving…':enabled?'Disable':'Allow'}</button></div>
  {state.message&&<p className="bo-core-feedback" role={state.ok?'status':'alert'}>{state.message}</p>}
 </form>;
}
export function CorePlanAccessEditor({plan,values}:{plan:string;values:Record<string,boolean>}){
 return <div className="bo-core-feature-list">{essentialCapabilities.map(feature=><OneCore key={plan+feature.key} plan={plan} feature={feature} enabled={values[feature.key]??true}/>)}</div>;
}
