'use client';
import {useActionState} from 'react';
import {sendAdminTestEmail,type EmailTestResult} from './actions';
export function EmailTestForm({templateKey,enabled}:{templateKey:string;enabled:boolean}){
 const [state,action,pending]=useActionState(sendAdminTestEmail,{error:'',success:''} as EmailTestResult);
 return <form action={action} style={{marginTop:12}}>
  <input type="hidden" name="template_key" value={templateKey}/>
  <button type="submit" className="btn" disabled={!enabled||pending}>{pending?'Sending test…':'Send test to my email'}</button>
  {state.error&&<p className="negative small" role="alert">{state.error}</p>}
  {state.success&&<p className="small" role="status">{state.success}</p>}
 </form>;
}
