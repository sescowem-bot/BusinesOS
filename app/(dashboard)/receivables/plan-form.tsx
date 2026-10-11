'use client';
import {useActionState} from 'react';
import {saveInstallmentPlan,type PaymentPlanState} from './actions';
const init:PaymentPlanState={ok:false,message:''};
export function InstalmentForm({order}:{order:string}){
 const [result,action,pending]=useActionState(saveInstallmentPlan,init);
 return <details className="bo-installment-details"><summary>Arrange instalments</summary><form action={action} className="bo-installment-form"><input type="hidden" name="order" value={order}/><label>Number of payments<select name="count" defaultValue="3">{[2,3,4,6,12,18,24].map(n=><option value={n} key={n}>{n}</option>)}</select></label><label>First payment date<input name="due" type="date" required/></label><label>Payment frequency<select name="interval" defaultValue="30"><option value="7">Every week</option><option value="14">Every 2 weeks</option><option value="30">Every 30 days</option></select></label><label>Notes (optional)<textarea name="note" maxLength={600} rows={2} placeholder="Agreement details"/></label><button className="btn btn-primary" disabled={pending} type="submit">{pending?'Saving…':'Save arrangement'}</button>{result.message&&<p role="status" className={result.ok?'positive':'small muted'}>{result.message}</p>}</form></details>;
}
