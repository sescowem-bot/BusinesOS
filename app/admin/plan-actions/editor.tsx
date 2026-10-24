'use client';
import {useActionState,useMemo,useState} from 'react';
import {actionModules,roleActions,matrixFromSaved,serializeMatrix,actionKey,essentialModuleKeys,type ActionRole,type StoredDecision,type ActionDecision} from '@/lib/role-action-catalog';
import {savePlanActionMatrix,type MatrixSaveState} from './actions';
const initial:MatrixSaveState={ok:false,message:''};
const labels:Record<string,string>={view:'View records',create:'Add records',edit:'Update records',delete:'Delete records',approve:'Approve or publish',export:'Export records'};
export function ActionMatrixEditor({planId,planName,role,rows}:{planId:string;planName:string;role:ActionRole;rows:StoredDecision[]}){
 const [state,action,pending]=useActionState(savePlanActionMatrix,initial);
 const [matrix,setMatrix]=useState(()=>matrixFromSaved(rows,role));
 const entries=useMemo(()=>serializeMatrix(matrix),[matrix]);
 const change=(module:string,verb:string,value:ActionDecision)=>setMatrix(old=>({...old,[actionKey(module,verb)]:value}));
 return <form action={action} className="bo-matrix-editor">
  <input type="hidden" name="plan_id" value={planId}/><input type="hidden" name="role" value={role}/>
  <input type="hidden" name="entries" value={JSON.stringify(entries)}/>
  <div className="card card-pad"><h2>{planName} · {role} role</h2><p className="small muted">Choose <strong>Keep existing rule</strong>, <strong>Allow within existing access</strong> or <strong>Deny</strong>. Allow never unlocks a paid module, bypasses business membership or overrides a financial approval rule. These settings are not enforced until the separately tested database rollout.</p></div>
  {[true,false].map(core=><section key={String(core)} className="card card-pad" style={{marginTop:16}}><h3>{core?'Core modules on all plans':'Premium subscription modules'}</h3>
   {actionModules.filter(mod=>essentialModuleKeys.has(mod.key)===core).map(mod=><details key={mod.key} className="bo-action-module"><summary><strong>{mod.name}</strong> <span className="small muted">{core?'Core workspace':'Requires active paid entitlement'}</span></summary><div className="table-wrap"><table className="table"><thead><tr><th>Action</th><th>Permission preference</th></tr></thead><tbody>{roleActions.map(verb=>{const key=actionKey(mod.key,verb),reserved=role==='owner'&&mod.key==='settings'&&verb==='view';return <tr key={verb}><th scope="row">{labels[verb]}</th><td><label className="bo-matrix-label"><span className="sr-only">{mod.name} {verb} for {role}</span><select aria-label={mod.name+' '+verb+' for '+role} disabled={reserved} value={reserved?'allow':matrix[key]} onChange={e=>change(mod.key,verb,e.target.value as ActionDecision)}><option value="inherit">Keep existing rule</option><option value="allow">Allow within existing access</option><option value="deny">Deny</option></select></label>{reserved&&<span className="small muted">Protected owner setting</span>}</td></tr>})}</tbody></table></div></details>)}
  </section>)}
  <div className="card card-pad" style={{marginTop:16}}><button className="btn btn-primary" type="submit" disabled={pending}>{pending?'Saving…':'Save audited role permissions'}</button>{state.message&&<p role={state.ok?'status':'alert'} className={state.ok?'positive':'negative'}>{state.message}</p>}</div>
 </form>;
}
