'use client';
import {useActionState,useState} from 'react';
import {submitSupportRequest,type SupportState} from './actions';
const initial:SupportState={ok:false,message:''};
export function SupportForm({isOwner,members}:{isOwner:boolean;members:{user_id:string;full_name:string;role:string}[]}){
 const [state,action,pending]=useActionState(submitSupportRequest,initial);
 const [kind,setKind]=useState('general');
 return <form className="comms-form" action={action}>
  <label>How can we help?<select name="kind" value={kind} onChange={e=>setKind(e.target.value)}><option value="general">General platform assistance</option>{isOwner&&<option value="role_change">Request staff role assistance</option>}</select></label>
  {kind==='role_change'&&isOwner&&<><p className="small muted">Only existing team members can be assigned a non-owner role. Your request authorises one specific change; the platform team cannot impersonate your staff.</p><label>Team member<select name="target" required defaultValue=""><option value="">Select team member</option>{members.filter(m=>m.role!=='owner').map(m=><option key={m.user_id} value={m.user_id}>{m.full_name||m.user_id.slice(0,8)} — {m.role}</option>)}</select></label><label>Requested role<select name="proposed_role"><option value="staff">Staff</option><option value="sales">Sales</option><option value="inventory">Inventory</option><option value="finance">Finance</option><option value="manager">Manager</option></select></label></>}
  <label>Subject<input type="text" name="subject" minLength={5} maxLength={140} required placeholder="e.g. Help setting up staff permissions"/></label>
  <label>Explain what you need<textarea name="details" rows={4} minLength={10} maxLength={2000} required placeholder="Tell our team what you need help with. Do not share passwords or secret keys."/></label>
  <button className="btn btn-primary" disabled={pending}>{pending?'Sending…':'Send support request'}</button>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}
