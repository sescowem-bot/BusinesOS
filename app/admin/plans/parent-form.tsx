'use client';
import {useActionState} from 'react';
import {updatePlanParent,type ParentState} from './parent-actions';
const initial:ParentState={ok:false,message:''};
export function ParentPlanForm({planId,selected,plans}:{planId:string;selected:string;plans:{id:string;name:string}[]}){
 const [state,action,pending]=useActionState(updatePlanParent,initial);
 return <form action={action} className="card card-pad" style={{display:'grid',gap:12,marginTop:14}}>
  <input type="hidden" name="plan_id" value={planId}/>
  <label>Inherit features from a lower plan
   <select name="parent_plan_id" defaultValue={selected} style={{display:'block',width:'100%',marginTop:7}}>
    <option value="">Independent plan (no inheritance)</option>
    {plans.filter(p=>p.id!==planId).map(p=><option value={p.id} key={p.id}>{p.name}</option>)}
   </select>
  </label>
  <p className="small muted">Inherited permissions are additive. This setting cannot remove capabilities already granted by the lower plan. Circular links are rejected.</p>
  <button className="btn btn-primary" disabled={pending} type="submit">{pending?'Saving…':'Save tier inheritance'}</button>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}
