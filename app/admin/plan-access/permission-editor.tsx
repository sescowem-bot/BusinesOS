'use client';

import {useActionState,useMemo,useRef,useState} from 'react';
import {paidCapabilities,planRoles,defaultFeatureRoleAccess,type PaidFeature,type PlanRole} from '@/lib/plan-catalog';
import {savePlanPermissions,type PermissionState} from './actions';

const initial:PermissionState={ok:false,message:''};
type RoleMap=Record<PaidFeature,PlanRole[]>;
type FeatureMap=Record<PaidFeature,boolean>;

export function PlanPermissionEditor({planId,initialFeatures,initialRoles}:{planId:string;initialFeatures:Partial<Record<PaidFeature,boolean>>;initialRoles:Partial<Record<PaidFeature,Partial<Record<PlanRole,boolean>>>>}){
 const [state,action,pending]=useActionState(savePlanPermissions,initial);
 const [features,setFeatures]=useState<FeatureMap>(()=>Object.fromEntries(paidCapabilities.map(f=>[f.key,initialFeatures[f.key]===true])) as FeatureMap);
 const [roles,setRoles]=useState<RoleMap>(()=>Object.fromEntries(paidCapabilities.map(f=>[f.key,planRoles.filter(r=>r.key!=='owner'&&(initialRoles[f.key]?.[r.key]??defaultFeatureRoleAccess[f.key].includes(r.key))).map(r=>r.key)])) as RoleMap);
 const [editing,setEditing]=useState<PaidFeature|null>(null);
 const dialog=useRef<HTMLDialogElement>(null);
 const groups=useMemo(()=>[...new Set(paidCapabilities.map(f=>f.group))],[]);
 const checkedCount=paidCapabilities.filter(f=>features[f.key]).length;
 function updateRole(feature:PaidFeature,role:PlanRole,checked:boolean){if(role==='owner')return;setRoles(prev=>({...prev,[feature]:checked?[...new Set([...prev[feature],role])]:prev[feature].filter(r=>r!==role)}));}
 function openRoles(feature:PaidFeature){if(!features[feature])return;setEditing(feature);dialog.current?.showModal();}
 function closeRoles(){dialog.current?.close();setEditing(null);}
 const editingDetails=paidCapabilities.find(f=>f.key===editing);
 return <>
  <form action={action} className="bo-feature-editor"><input type="hidden" name="plan_id" value={planId}/><input type="hidden" name="features" value={JSON.stringify(features)}/><input type="hidden" name="roles" value={JSON.stringify(roles)}/>
   <div className="bo-feature-toolbar"><p><strong>{checkedCount} of {paidCapabilities.length}</strong> premium modules selected</p><span className="small muted">Roles are edited separately for each enabled module.</span></div>
   {groups.map(group=><section key={group} className="bo-feature-group" aria-label={group+' modules'}><h3>{group}</h3>
    {paidCapabilities.filter(f=>f.group===group).map(f=><div className="bo-feature-card" key={f.key}>
     <div className="bo-feature-text"><strong>{f.name}</strong><p>{f.detail}</p></div>
     <div className="bo-feature-actions"><label className="bo-switch-label"><input type="checkbox" checked={features[f.key]} disabled={planId==='free'&&!features[f.key]} onChange={e=>setFeatures(old=>({...old,[f.key]:e.target.checked}))}/><span>{features[f.key]?'Included':'Not included'}</span></label>
      <button className="btn bo-role-edit" type="button" disabled={!features[f.key]} onClick={()=>openRoles(f.key)}>Select roles <span aria-hidden="true">({roles[f.key].length})</span></button></div>
    </div>)}
   </section>)}
   {planId==='free'&&<p className="bo-plan-studio-advice" role="note">Premium-module changes are disabled for Free because the existing backend intentionally blocks those grants. Do not present this as an effective Free premium-plan switch until its database policy, billing and upgrade behaviour have been redesigned and tested.</p>}
   <div className="bo-feature-save"><div><strong>Review before publishing</strong><p className="small muted">These settings may change access for businesses already on this plan. A staff member also needs a valid business membership and the required action permission.</p></div><button type="submit" className="btn btn-primary" disabled={pending}>{pending?'Saving permissions…':'Save module & role access'}</button></div>
   {state.message&&<p role={state.ok?'status':'alert'} className={state.ok?'positive':'negative'}>{state.message}</p>}
  </form>
  <dialog ref={dialog} className="bo-role-dialog" aria-label={editingDetails?'Choose staff roles for '+editingDetails.name:'Select staff roles'} onClose={()=>setEditing(null)}>
   {editing&&editingDetails&&<div className="bo-role-dialog-body">
    <div className="bo-role-dialog-top"><div><span className="small muted">MODULE PERMISSIONS</span><h2>{editingDetails.name}</h2><p>Select additional staff roles allowed to use this module.</p></div><button type="button" className="bo-role-dialog-close" aria-label="Close role selector" onClick={closeRoles}>×</button></div>
    <div className="bo-role-dialog-owner"><strong>Business Owner</strong><span>Included automatically when the module is enabled</span></div>
    <fieldset className="bo-role-choice-grid"><legend>Additional staff roles</legend><p className="small muted">Select the staff roles that should have access. The system never grants a subscription module to users outside their business.</p>
     <div className="bo-role-choice-grid-inner">{planRoles.filter(r=>r.key!=='owner').map(r=><label key={r.key} className="bo-role-checkbox"><input type="checkbox" checked={roles[editing].includes(r.key)} onChange={e=>updateRole(editing,r.key,e.target.checked)}/><span><strong>{r.name}</strong><small>{r.detail}</small></span></label>)}</div>
    </fieldset>
    <div className="bo-role-dialog-footer"><p className="small muted">Your selections are not saved until you use “Save module &amp; role access”.</p><button type="button" className="btn btn-primary" onClick={closeRoles}>Done selecting</button></div>
   </div>}
  </dialog>
 </>;
}
