'use client';
import {useActionState,useState} from 'react';
import {paidCapabilities,planRoles} from '@/lib/plan-catalog';
import {moduleWorkflows} from '@/lib/feature-directory';
import {saveCompanyModulePrice,saveCompanyRole,assignCompanyRole,type AccessFormState} from './company-access-actions';
const initial:AccessFormState={ok:false,message:''};
const Feedback=({state}:{state:AccessFormState})=>state.message?<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>:null;
export function CompanyPriceForm({businessId,prices}:{businessId:string;prices:{feature_key:string;price_monthly_ngn:number|null;price_yearly_ngn:number|null;note:string}[]}){
 const [state,action,pending]=useActionState(saveCompanyModulePrice,initial);
 const [feature,setFeature]=useState('pos');
 const existing=prices.find(x=>x.feature_key===feature);
 return <form action={action} className="comms-form"><input type="hidden" name="business" value={businessId}/><label>Module<select name="feature" value={feature} onChange={e=>setFeature(e.target.value)}>{paidCapabilities.map(p=><option key={p.key} value={p.key}>{p.name}</option>)}</select></label>
 <div className="grid grid-2" key={feature}><label>Monthly (₦)<input name="monthly" type="number" min="0" step="0.01" defaultValue={existing?.price_monthly_ngn??''} placeholder="Custom quote if blank"/></label><label>Annual (₦)<input name="yearly" type="number" min="0" step="0.01" defaultValue={existing?.price_yearly_ngn??''}/></label></div>
 <label>Commercial note<textarea name="note" maxLength={500} defaultValue={existing?.note||''} key={feature} placeholder="Optional: trial, negotiated pricing, expiry or contract reference"/></label>
 <p className="small muted">These are proposed commercial terms only. Saving does not activate modules, charge the business or change its current plan.</p>
 <button className="btn btn-primary" disabled={pending}>{pending?'Saving…':'Save company module price'}</button><Feedback state={state}/></form>;
}
type Profile={id:string;name:string;description:string;base_role:string;allowed_modules:string[];active:boolean};
export function CompanyRoleForm({businessId,profiles}:{businessId:string;profiles:Profile[]}){
 const [state,action,pending]=useActionState(saveCompanyRole,initial);
 const [selected,setSelected]=useState('');const [modules,setModules]=useState<string[]>([]);
 const p=profiles.find(x=>x.id===selected);
 function change(next:string){setSelected(next);setModules(profiles.find(x=>x.id===next)?.allowed_modules||[])}
 return <form action={action} className="comms-form"><input name="business" type="hidden" value={businessId}/><label>Edit existing or create a company role<select name="profile" value={selected} onChange={e=>change(e.target.value)}><option value="">Create new named role</option>{profiles.map(r=><option value={r.id} key={r.id}>{r.name} · {r.base_role}</option>)}</select></label>
 <div key={selected}><label>Role display name<input name="name" maxLength={70} minLength={3} required defaultValue={p?.name||''} placeholder="e.g. Cashier or Store Supervisor"/></label>
 <label>Description<textarea name="description" maxLength={500} defaultValue={p?.description||''} placeholder="What this employee handles day to day"/></label>
 <label>Secure base role<select name="base_role" defaultValue={p?.base_role||'sales'}>{planRoles.filter(x=>x.key!=='owner').map(x=><option key={x.key} value={x.key}>{x.name} · {x.detail}</option>)}</select></label></div>
 <fieldset className="plan-module-role-box"><legend>Maximum additional modules for this role</legend><p className="small muted">The business must still have the module through its plan or an approved company extra. Selecting a module here never grants it by itself.</p><div className="grid grid-2">{paidCapabilities.map(f=><label className="plan-module-checkbox" key={f.key}><input name="module" type="checkbox" value={f.key} checked={modules.includes(f.key)} onChange={e=>setModules(old=>e.target.checked?[...old,f.key]:old.filter(x=>x!==f.key))}/><span><strong>{f.name}</strong><small>{(moduleWorkflows[f.key]||[]).slice(0,3).join(' · ')}</small></span></label>)}</div></fieldset>
 <label>Role status<select name="active" defaultValue={p?.active===false?'no':'yes'} key={`${selected}-active`}><option value="yes">Active</option><option value="no">Inactive (block assigned premium modules)</option></select></label>
 <button className="btn btn-primary" disabled={pending}>{pending?'Saving…':selected?'Update role template':'Create company role'}</button><Feedback state={state}/></form>;
}
export function CompanyRoleAssignmentForm({businessId,profiles,members,assigned}:{businessId:string;profiles:Profile[];members:{user_id:string;full_name:string|null;role:string}[];assigned:{user_id:string;profile_id:string}[]}){
 const [state,action,pending]=useActionState(assignCompanyRole,initial);
 const [user,setUser]=useState('');const member=members.find(m=>m.user_id===user);
 const selected=assigned.find(a=>a.user_id===user)?.profile_id||'';
 return <form action={action} className="comms-form"><input name="business" type="hidden" value={businessId}/><label>Existing staff member<select name="user" value={user} onChange={e=>setUser(e.target.value)} required><option value="">Choose a non-owner employee</option>{members.filter(m=>m.role!=='owner').map(m=><option value={m.user_id} key={m.user_id}>{m.full_name?.trim()||m.user_id.slice(0,8)} · {m.role}</option>)}</select></label>
 <label>Named company role<select name="profile" key={`${user}-${selected}`} defaultValue={selected}><option value="">No company profile — normal base role</option>{profiles.filter(p=>p.active&&p.base_role===member?.role).map(p=><option key={p.id} value={p.id}>{p.name} ({p.base_role})</option>)}</select></label>
 <p className="small muted">Company profiles only restrict the modules available under the member's existing secure base role. To change their base role, use the audited role-change workflow first.</p>
 <button className="btn btn-primary" disabled={!user||pending}>{pending?'Saving…':'Assign company role'}</button><Feedback state={state}/></form>;
}
