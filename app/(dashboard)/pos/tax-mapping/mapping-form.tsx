'use client';
import {useActionState} from 'react';
import {savePosTaxMapping,type MappingState} from './actions';
const initial:MappingState={error:'',success:''};
export function MappingForm({products,supplies}:{products:{id:string;name:string}[];supplies:{id:string;name:string}[]}){
 const [state,action,pending]=useActionState(savePosTaxMapping,initial);
 return <form action={action} className="comms-form"><label>Product <select name="product" required defaultValue=""><option value="">Select product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <label>Business supply category <select name="supply" required defaultValue=""><option value="">Select reviewed category</option>{supplies.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
 <button className="btn btn-primary" type="submit" disabled={pending||!products.length||!supplies.length}>{pending?'Saving…':'Link product to category'}</button>
 {state.error&&<p role="alert" className="negative">{state.error}</p>}{state.success&&<p role="status" className="positive">{state.success}</p>}
 </form>;
}
