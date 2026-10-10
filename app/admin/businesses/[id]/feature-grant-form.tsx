'use client';
import {useActionState,useState} from 'react';
import {paidCapabilities,planRoles,type PaidFeature,type PlanRole} from '@/lib/plan-catalog';
import {saveBusinessGrant,type GrantState} from './grant-actions';
const initial:GrantState={ok:false,message:''};
export function FeatureGrantForm({businessId,current}:{businessId:string;current:{feature_key:string;enabled:boolean;allowed_roles:string[];expires_at:string|null;note:string}[]}){
 const [state,action,pending]=useActionState(saveBusinessGrant,initial);
 const [feature,setFeature]=useState<PaidFeature>('inventory');
 const existing=current.find(g=>g.feature_key===feature);
 const [roles,setRoles]=useState<PlanRole[]>(['owner']);
 function selectFeature(f:PaidFeature){setFeature(f);const record=current.find(g=>g.feature_key===f);setRoles((record?.allowed_roles||['owner']).filter((r):r is PlanRole=>planRoles.some(t=>t.key===r)))}
 return <form action={action} className="card card-pad" style={{display:'grid',gap:12}}>
  <h2>Grant extra features to this business</h2>
  <p className="small muted">This changes one organisation only. It does not affect the plan catalogue or remove capabilities included in an approved plan.</p>
  <input type="hidden" name="business_id" value={businessId}/>
  <label>Module <select name="feature" value={feature} onChange={e=>selectFeature(e.target.value as PaidFeature)}>{paidCapabilities.map(f=><option key={f.key} value={f.key}>{f.name}</option>)}</select></label>
  <label>Status <select name="enabled" defaultValue={existing?.enabled===false?'no':'yes'} key={`${feature}-state`}><option value="yes">Grant additional access</option><option value="no">Disable this extra grant</option></select></label>
  <fieldset style={{border:'1px solid #e1e8ee',padding:12,borderRadius:10}}><legend>Business staff roles</legend>
   {planRoles.map(r=><label key={r.key} style={{display:'inline-flex',gap:6,alignItems:'center',marginRight:14,marginBottom:8}}><input type="checkbox" value={r.key} name="roles" checked={roles.includes(r.key)} disabled={r.key==='owner'} onChange={e=>setRoles(old=>e.target.checked?[...old,r.key]:old.filter(x=>x!==r.key))}/>{r.name}</label>)}
   <input type="hidden" name="roles" value="owner"/>
  </fieldset>
  <label>Optional expiry (UTC) <input name="expires_at" type="date" key={`${feature}-expires`} defaultValue={existing?.expires_at?.slice(0,10)||''}/></label>
  <label>Administrative reason <textarea name="note" required minLength={5} maxLength={1000} key={`${feature}-note`} defaultValue={existing?.note||''} placeholder="Approved add-on, trial or courtesy access; reference the agreed terms."/></label>
  <button className="btn btn-primary" disabled={pending} type="submit">{pending?'Saving…':'Save business-specific grant'}</button>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}
