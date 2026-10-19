'use client';
import {useActionState,useState} from 'react';
import {updatePlanParent,type ParentState} from './parent-actions';
const initial:ParentState={ok:false,message:''};
export function ParentPlanForm({planId,selected,plans}:{planId:string;selected:string;plans:{id:string;name:string}[]}){
 const [state,action,pending]=useActionState(updatePlanParent,initial);
 const [current,setCurrent]=useState(selected);
 const [submittedChoice,setSubmittedChoice]=useState(selected);
 return <form action={action} onSubmit={()=>setSubmittedChoice(current)} className="card card-pad" style={{display:'grid',gap:12,marginTop:14}}>
  <input type="hidden" name="plan_id" value={planId}/><input type="hidden" name="original_parent_id" value={selected}/>
  <label>Inherit features from a lower plan
   <select name="parent_plan_id" value={current} onChange={e=>setCurrent(e.target.value)} style={{display:'block',width:'100%',marginTop:7}}>
    <option value="">Independent plan (no inheritance)</option>
    {plans.filter(p=>p.id!==planId).map(p=><option value={p.id} key={p.id}>{p.name}</option>)}
   </select>
  </label>
  <p className="small muted">Inherited permissions are additive. This setting cannot remove capabilities already granted by the lower plan. Circular links are rejected.</p>
  <button className="btn btn-primary" disabled={pending||current===selected} type="submit">{pending?'Saving…':'Save plan inheritance'}</button>
  {current===selected&&<p className="small muted" role="status">No change to save. Choose another plan to update this relationship.</p>}
  {state.message&&current===submittedChoice&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}
