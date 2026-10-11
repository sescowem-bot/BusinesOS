'use client';
import {useActionState} from 'react';
import {sendBalanceReminder,type BalanceReminderState} from './reminder-actions';
const initial:BalanceReminderState={ok:false,message:''};
export function BalanceReminderForm({order}:{order:string}){
 const [state,action,pending]=useActionState(sendBalanceReminder,initial);
 return <form action={action} className="bo-balance-reminder"><input name="order" type="hidden" value={order}/><button className="btn" type="submit" disabled={pending}>{pending?'Sending…':'Email payment reminder'}</button>{state.message&&<p className={state.ok?'positive':'small muted'} role="status">{state.message}</p>}</form>;
}
