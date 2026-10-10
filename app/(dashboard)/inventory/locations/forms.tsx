'use client';
import {useActionState,useEffect,useState} from 'react';
import {enableBranchLocation,transferBranchStock,countBranchStock,type LocationActionState} from './actions';
type Location={id:string;name:string;is_unallocated:boolean};
type Product={id:string;name:string};
const initial:LocationActionState={error:'',success:''};
const field={width:'100%',minWidth:0,padding:'10px 12px',border:'1px solid #ccd8e1',borderRadius:10};
function Feedback({state}:{state:LocationActionState}){return state.error||state.success?<p role={state.error?'alert':'status'} style={{color:state.error?'#b42318':'#16845b'}}>{state.error||state.success}</p>:null;}
function IdInput({refresh}:{refresh:string}){const [id,setId]=useState('');useEffect(()=>setId(crypto.randomUUID()),[refresh]);return <input type="hidden" name="request" value={id}/>;}
export function EnableBranchForm({branches}:{branches:{id:string;name:string}[]}){
 const [state,action,pending]=useActionState(enableBranchLocation,initial);
 return <form action={action} className="comms-form"><label>Active business branch<select style={field} name="branch" required defaultValue=""><option value="">Select branch</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><button className="btn btn-primary" disabled={pending||!branches.length}>{pending?'Enabling…':'Enable location'}</button><Feedback state={state}/></form>;
}
export function BranchTransferForm({locations,products}:{locations:Location[];products:Product[]}){
 const [state,action,pending]=useActionState(transferBranchStock,initial);
 const [source,setSource]=useState(locations.find(l=>l.is_unallocated)?.id||locations[0]?.id||'');
 const [target,setTarget]=useState(locations.find(l=>l.id!==source)?.id||'');
 const [stamp,setStamp]=useState('init');
 useEffect(()=>{if(state.success)setStamp(crypto.randomUUID())},[state.success]);
 return <form action={action} className="comms-form"><IdInput refresh={stamp}/><label>Product<select style={field} name="product" required defaultValue=""><option value="">Select tracked product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <label>From location<select style={field} name="from" value={source} onChange={e=>{setSource(e.target.value);if(target===e.target.value)setTarget(locations.find(l=>l.id!==e.target.value)?.id||'')}} required>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
 <label>To location<select style={field} name="to" value={target} onChange={e=>setTarget(e.target.value)} required><option value="">Select destination</option>{locations.filter(l=>l.id!==source).map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
 <label>Transfer quantity<input style={field} name="quantity" type="number" step="0.001" min="0.001" required/></label>
 <label>Reason / transfer reference<input style={field} name="reason" minLength={5} maxLength={500} required placeholder="Store replenishment from receiving area"/></label>
 <button className="btn btn-primary" disabled={pending||locations.length<2||!products.length||!target||target===source}>{pending?'Transferring…':'Transfer stock'}</button><Feedback state={state}/></form>;
}
export function BranchStockCountForm({locations,products,balances}:{locations:Location[];products:Product[];balances:Record<string,Record<string,number>>}){
 const [state,action,pending]=useActionState(countBranchStock,initial);
 const [location,setLocation]=useState(locations[0]?.id||'');const [product,setProduct]=useState('');const [stamp,setStamp]=useState('init');
 useEffect(()=>{if(state.success)setStamp(crypto.randomUUID())},[state.success]);
 const expected=product?(balances[location]?.[product]||0):0;
 return <form action={action} className="comms-form"><IdInput refresh={stamp}/><label>Location<select style={field} name="location" value={location} onChange={e=>setLocation(e.target.value)} required>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
 <label>Tracked product<select style={field} name="product" value={product} onChange={e=>setProduct(e.target.value)} required><option value="">Select product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <label>Current location balance<input style={field} name="expected" type="number" readOnly value={product?expected:''}/></label>
 <label>Physically counted quantity<input style={field} name="counted" type="number" min="0" step="0.001" key={`${location}-${product}`} required/></label>
 <label>Count reason / reference<input style={field} name="reason" minLength={5} maxLength={500} required placeholder="Branch stocktake: October closing"/></label>
 <button className="btn btn-primary" disabled={pending||!location||!product}>{pending?'Recording…':'Record location stock count'}</button><Feedback state={state}/></form>;
}
