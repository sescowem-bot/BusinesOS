'use client';
import {useActionState} from 'react';
import {sendRenewalReminder,type ReminderState} from './actions';
const initial:ReminderState={ok:false,message:''};
export function ReminderForm({businessId,expiry}:{businessId:string;expiry:string}){
 const [state,action,pending]=useActionState(sendRenewalReminder,initial);
 return <form action={action}><input type="hidden" name="business_id" value={businessId}/><input type="hidden" name="expiry" value={expiry}/><button type="submit" disabled={pending} className="btn">{pending?'Sending…':'Email renewal reminder'}</button>{state.message&&<p role="status" className={state.ok?'positive':'small muted'}>{state.message}</p>}</form>;
}
