'use client';
import {useActionState,useState} from 'react';
import {paidCapabilities,planRoles,defaultFeatureRoleAccess,type PaidFeature,type PlanRole} from '@/lib/plan-catalog';
import {savePlanPermissions,type PermissionState} from './actions';
const initial:PermissionState={ok:false,message:''};
type RoleMap=Record<PaidFeature,PlanRole[]>;
type FeatureMap=Record<PaidFeature,boolean>;
export function PlanPermissionEditor({planId,initialFeatures,initialRoles}:{planId:string;initialFeatures:Partial<Record<PaidFeature,boolean>>;initialRoles:Partial<Record<PaidFeature,Partial<Record<PlanRole,boolean>>>>}){
 const [state,action,pending]=useActionState(savePlanPermissions,initial);
 const [features,setFeatures]=useState<FeatureMap>(()=>Object.fromEntries(paidCapabilities.map(f=>[f.key,initialFeatures[f.key]===true])) as FeatureMap);
 const [roles,setRoles]=useState<RoleMap>(()=>Object.fromEntries(paidCapabilities.map(f=>[f.key,planRoles.filter(r=>r.key!=='owner'&&(initialRoles[f.key]?.[r.key]??defaultFeatureRoleAccess[f.key].includes(r.key))).map(r=>r.key)])) as RoleMap);
 function updateRole(feature:PaidFeature,role:PlanRole,checked:boolean){setRoles(prev=>({...prev,[feature]:checked?[...prev[feature],role]:prev[feature].filter(r=>r!==role)}))}
 return <form action={action} className="plan-permissions-form"><input type="hidden" name="plan_id" value={planId}/><input type="hidden" name="features" value={JSON.stringify(features)}/><input type="hidden" name="roles" value={JSON.stringify(roles)}/>
  <div className="plan-role-key"><strong>Business staff roles:</strong> {planRoles.map(r=><span key={r.key} title={r.detail}>{r.name}</span>)}</div>
  <div className="plan-permissions-list">{paidCapabilities.map(f=><section className="plan-feature-row" key={f.key}>
   <div className="plan-feature-description"><span className="small muted">{f.group}</span><h3>{f.name}</h3><p className="small muted">{f.detail}</p></div>
   <div className="plan-feature-controls"><label className="plan-feature-switch"><input type="checkbox" checked={features[f.key]} onChange={e=>setFeatures(old=>({...old,[f.key]:e.target.checked}))}/><strong>{features[f.key]?'Included in this plan':'Not included'}</strong></label>
   <div className="plan-role-checks" aria-label={`${f.name} role permissions`}>{planRoles.map(role=><label key={role.key} title={role.detail}><input type="checkbox" disabled={!features[f.key]||role.key==='owner'} checked={role.key==='owner'?features[f.key]:roles[f.key].includes(role.key)} onChange={e=>updateRole(f.key,role.key,e.target.checked)}/>{role.name}</label>)}</div></div>
  </section>)}</div>
  <div className="plan-permission-footer"><p className="small muted">Owners always retain access when a module is enabled. A staff role gets a module only if both its plan and role permission allow it. The existing core business workspace remains available on all plans.</p><button className="btn btn-primary" type="submit" disabled={pending}>{pending?'Saving permissions…':'Save plan access and roles'}</button></div>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}
