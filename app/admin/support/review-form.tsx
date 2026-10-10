'use client';
import {useActionState} from 'react';
import {resolvePlatformSupport,type AdminSupportState} from './actions';
const initial:AdminSupportState={ok:false,message:''};
export function ReviewSupportForm({id,roleChange}:{id:string;roleChange:boolean}){
 const [state,action,pending]=useActionState(resolvePlatformSupport,initial);
 return <form className="comms-form" action={action}><input type="hidden" name="ticket" value={id}/>
 <label>Decision<select name="decision"><option value="resolve">Mark resolved (help provided)</option><option value="decline">Decline request</option>{roleChange&&<option value="apply_role">Apply owner's requested role change</option>}</select></label>
 <label>Response for customer<textarea name="note" minLength={5} maxLength={2000} required rows={2} placeholder="Explain what was done or why it was declined"/></label>
 <button className="btn btn-primary" disabled={pending}>{pending?'Saving…':'Save response'}</button>
 {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}
