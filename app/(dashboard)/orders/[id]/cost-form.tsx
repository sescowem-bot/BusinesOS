'use client';
import {useActionState} from 'react';
import {recordOrderCost,type CostState} from './cost-actions';
const initial:CostState={ok:false,message:''};
export function OrderCostForm({order}:{order:string}){
 const [state,action,pending]=useActionState(recordOrderCost,initial);
 return <form action={action} className="comms-form" style={{maxWidth:400}}><input type="hidden" name="order" value={order}/>
 <label>Verified item cost per unit (₦)<input type="number" name="cost" min="0" step="0.01" required placeholder="Enter the actual known unit cost"/></label>
 <label className="bo-checkbox"><input type="checkbox" name="confirmed" value="yes" required/> I verified this amount from appropriate cost records. An unknown cost must not be entered as zero.</label>
 <button type="submit" className="btn btn-primary" disabled={pending}>{pending?'Recording…':'Save one-time cost evidence'}</button>
 {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}
