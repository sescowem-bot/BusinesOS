'use client';
import {useActionState,useState} from 'react';
import {nameFieldMessage,amountFieldMessage} from '@/lib/form-experience';
import '@/components/form-experience.css';
import {addCatalogItem,adjustStock,recordStockCount,type CatalogState} from './actions';
const initial:CatalogState={error:'',success:''};
const input={width:'100%',padding:'10px 12px',border:'1px solid #d0d5dd',borderRadius:8};
function Status({state}:{state:CatalogState}){return <p aria-live="polite" role={state.error?'alert':undefined} style={{color:state.error?'#b42318':'#16845b'}}>{state.error||state.success}</p>}
export function ItemForm(){
 const [state,action,pending]=useActionState(addCatalogItem,initial);
 const [type,setType]=useState('product');const [track,setTrack]=useState(false);
 const [itemName,setItemName]=useState('');const [nameTouched,setNameTouched]=useState(false);
 const [price,setPrice]=useState('');const [cost,setCost]=useState('');
 const [priceTouched,setPriceTouched]=useState(false);const [costTouched,setCostTouched]=useState(false);
 const nameCheck=nameFieldMessage(itemName,1,160,'Item name');
 const priceCheck=amountFieldMessage(price,'Selling price');
 const costCheck=amountFieldMessage(cost,'Cost');
 return <form action={action} className="bo-guided-form">
  <div className="bo-field"><label htmlFor="catalog-item-name">Item name</label>
   <input name="name" id="catalog-item-name" value={itemName} onChange={e=>setItemName(e.target.value)} onBlur={()=>setNameTouched(true)} required maxLength={160} aria-invalid={nameTouched&&!nameCheck.valid} aria-describedby="catalog-item-name-hint" placeholder="e.g. Cotton shirt or Consultation"/>
   <p id="catalog-item-name-hint" className={'bo-field-hint'+(nameTouched&&!nameCheck.valid?' bo-field-error':'')}>{nameTouched&&!nameCheck.valid?nameCheck.message:'Use a short name customers and staff can recognise.'}</p>
  </div>
  <div className="bo-field"><label htmlFor="catalog-item-type">Item type</label>
   <select name="type" id="catalog-item-type" value={type} onChange={e=>{setType(e.target.value);setTrack(false)}}><option value="product">Physical product</option><option value="service">Service</option><option value="package">Package</option></select></div>
  <div className="bo-field"><label htmlFor="catalog-item-sku">SKU (optional)</label><input name="sku" id="catalog-item-sku" maxLength={100} placeholder="Internal reference"/></div>
  <div className="bo-field"><label htmlFor="catalog-item-description">Description (optional)</label><textarea name="description" id="catalog-item-description" rows={3} maxLength={2000}/></div>
  <div className="bo-field"><label htmlFor="catalog-selling-price">Selling price (₦)</label>
   <input name="price" id="catalog-selling-price" type="number" inputMode="decimal" step="0.01" min="0" required value={price} onChange={e=>setPrice(e.target.value)} onBlur={()=>setPriceTouched(true)} aria-invalid={priceTouched&&!priceCheck.valid} aria-describedby="catalog-price-hint"/>
   <p id="catalog-price-hint" className={'bo-field-hint'+(priceTouched&&!priceCheck.valid?' bo-field-error':'')}>{priceTouched&&!priceCheck.valid?priceCheck.message:'Enter the price in naira; at most two decimal places.'}</p></div>
  <div className="bo-field"><label htmlFor="catalog-item-cost">Cost (₦)</label>
   <input name="cost" id="catalog-item-cost" type="number" inputMode="decimal" step="0.01" min="0" required value={cost} onChange={e=>setCost(e.target.value)} onBlur={()=>setCostTouched(true)} aria-invalid={costTouched&&!costCheck.valid} aria-describedby="catalog-cost-hint"/>
   <p id="catalog-cost-hint" className={'bo-field-hint'+(costTouched&&!costCheck.valid?' bo-field-error':'')}>{costTouched&&!costCheck.valid?costCheck.message:'Use your actual purchase cost when known; enter 0 for no recorded cost.'}</p></div>
  {type!=='service'&&<label className="bo-form-choice"><input name="track" type="checkbox" checked={track} onChange={e=>setTrack(e.target.checked)}/><span><strong>Track physical stock</strong><br/>Optional paid inventory tool. Leave off to save this catalogue item without stock tracking.</span></label>}
  {track&&type!=='service'&&<><div className="bo-field"><label htmlFor="catalog-item-stock">Opening stock</label><input name="stock" id="catalog-item-stock" type="number" step="0.001" min="0" defaultValue="0"/></div><div className="bo-field"><label htmlFor="catalog-item-minimum">Low-stock threshold</label><input name="minimum" id="catalog-item-minimum" type="number" step="0.001" min="0" defaultValue="0"/></div></>}
  <p className="bo-field-hint">Tax classification still requires verification. Adding an item does not automatically charge VAT.</p>
  <div className="bo-form-actions"><button className="btn btn-primary" type="submit" disabled={pending||!nameCheck.valid||!priceCheck.valid||!costCheck.valid}>{pending?'Saving item…':'Save product or service'}</button></div>
  {state.error&&<p role="alert" className="bo-form-alert">{state.error}</p>}{state.success&&<p role="status" className="bo-form-success">{state.success}</p>}
 </form>;
}
export function AdjustmentForm({items}:{items:{id:string;name:string}[]}){const[state,action,pending]=useActionState(adjustStock,initial);return <form action={action} style={{display:'grid',gap:13,maxWidth:650}}><label>Tracked product<select name="item" required style={input} defaultValue=""><option value="">Select product</option>{items.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Quantity change (positive to add, negative to remove)<input style={input} name="delta" type="number" step="0.001" required/></label><label>Reason<input style={input} name="reason" minLength={3} maxLength={500} required/></label><button className="btn primary" disabled={pending||!items.length}>{pending?'Saving…':'Record adjustment'}</button><Status state={state}/></form>}

export function StockCountForm({items}:{items:{id:string;name:string;stock:number}[]}){
 const [state,action,pending]=useActionState(recordStockCount,initial);
 const [item,setItem]=useState('');
 const selected=items.find(x=>x.id===item);
 return <form action={action} style={{display:'grid',gap:13,maxWidth:650}}>
  <p className="muted small">Count stock on hand. If the recorded balance changed since you opened this page, the count will be rejected for safety.</p>
  <label>Product<select name="item" value={item} onChange={e=>setItem(e.target.value)} required style={input}><option value="">Select tracked product</option>{items.map(p=><option key={p.id} value={p.id}>{p.name} · {p.stock} on record</option>)}</select></label>
  <label>Expected quantity<input name="expected" type="number" readOnly value={selected?.stock??''} style={input}/></label>
  <label>Physically counted quantity<input name="counted" type="number" required min="0" step="0.001" style={input} key={item}/></label>
  <label>Reason / location / count reference<input name="reason" type="text" minLength={5} maxLength={500} required style={input} placeholder="Monthly physical stock count"/></label>
  <button className="btn primary" disabled={pending||!item}>{pending?'Recording…':'Record stock count'}</button><Status state={state}/>
 </form>;
}
