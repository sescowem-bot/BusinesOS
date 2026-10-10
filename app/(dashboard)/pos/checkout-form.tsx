'use client';
import {useActionState,useEffect,useMemo,useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {savePosCart,discardPosCart} from './held-actions';
import Link from 'next/link';
import {submitCheckout,type CheckoutState} from './actions';
import {money} from '@/lib/format';
import {previewPosPricing,type PosPriceMode} from '@/lib/pos-pricing';
type Product={id:string;name:string;sku:string|null;selling_price:number;stock_quantity:number;track_inventory:boolean};
type Customer={id:string;name:string};
type StockLocation={id:string;name:string;is_unallocated:boolean};
const initial:CheckoutState={ok:false,message:''};
type TaxPreview={ready:boolean;treatment:string;rate:number};
type HeldCart={id:string;label:string;location_id:string;customer_id:string|null;basket:unknown;price_mode:string;discount:number;updated_at:string};
type Tender={method:'cash'|'transfer'|'pos'|'card'|'other';amount:string;reference:string};
export function CheckoutForm({products,customers,taxMode,productTax,locations,locationStocks,heldCarts}:{products:Product[];customers:Customer[];taxMode:'reviewed'|'unverified';productTax:Record<string,TaxPreview>;locations:StockLocation[];locationStocks:Record<string,Record<string,number>>;heldCarts:HeldCart[]}){
 const [state,action,pending]=useActionState(submitCheckout,initial);
 const router=useRouter();
 const [saving,startSave]=useTransition();
 const [savedMessage,setSavedMessage]=useState('');
 const [heldLabel,setHeldLabel]=useState('');
 const [customerId,setCustomerId]=useState('');
 const barcodeInputRef=useRef<HTMLInputElement>(null);
 const [barcode,setBarcode]=useState('');
 const [barcodeMessage,setBarcodeMessage]=useState('');
 const [tenderMode,setTenderMode]=useState<'single'|'split'>('single');
 const [tenders,setTenders]=useState<Tender[]>([{method:'cash',amount:'',reference:''},{method:'transfer',amount:'',reference:''}]);
 const [locationId,setLocationId]=useState(locations.find(l=>l.is_unallocated)?.id||locations[0]?.id||'');
 const availableAt=(product:Product)=>product.track_inventory?(locationStocks[locationId]?.[product.id]||0):Infinity;
 const [basket,setBasket]=useState<{product_id:string;quantity:number}[]>([]);
 const [product,setProduct]=useState(products[0]?.id||'');
 const [quantity,setQuantity]=useState('1');
 const [requestId,setRequestId]=useState('');
 const [paid,setPaid]=useState(true);
 const [priceMode,setPriceMode]=useState<PosPriceMode>('exclusive');
 const [discount,setDiscount]=useState('0');
 const [query,setQuery]=useState('');
 useEffect(()=>setRequestId(crypto.randomUUID()),[]);
 useEffect(()=>{if(state.ok){setBasket([]);setDiscount('0');setRequestId(crypto.randomUUID())}},[state]);
 const displayed=products.filter(p=>(p.name+' '+(p.sku||'')).toLowerCase().includes(query.toLowerCase()));
 const total=useMemo(()=>basket.reduce((sum,line)=>sum+(products.find(p=>p.id===line.product_id)?.selling_price||0)*line.quantity,0),[basket,products]);
 const invalidTax=taxMode==='reviewed'&&basket.some(line=>!productTax[line.product_id]?.ready);
 const pricing=useMemo(()=>previewPosPricing(basket.map(line=>{const p=products.find(p=>p.id===line.product_id);return {product_id:line.product_id,quantity:line.quantity,price:p?.selling_price||0,rate:productTax[line.product_id]?.rate||0}}),priceMode,Number(discount||0)),[basket,products,productTax,priceMode,discount]);
 const vat=taxMode==='reviewed'?pricing.vat:0;
 const totalPayable=taxMode==='reviewed'?pricing.total:total;
 const invalidDiscount=taxMode==='reviewed'&&(!/^\d{1,12}(?:\.\d{1,2})?$/.test(discount)||!pricing.valid);
 const tenderSum=tenders.reduce((sum,t)=>sum+(Number(t.amount)||0),0);
 const invalidTenders=tenderMode==='split'&&(tenders.some(t=>!/^\d{1,10}(?:\.\d{1,2})?$/.test(t.amount)||Number(t.amount)<=0)||tenderSum>totalPayable+0.00001);
 const scan=()=>{
  const code=barcode.trim().toLowerCase();if(!code)return;
  const matches=products.filter(p=>p.sku?.trim().toLowerCase()===code);
  if(matches.length!==1){setBarcodeMessage('No unique SKU/barcode found in the loaded catalogue.');return;}
  const item=matches[0],old=basket.find(x=>x.product_id===item.id)?.quantity||0;
  if(basket.length>=30&&!old){setBarcodeMessage('Maximum 30 distinct products per checkout.');return;}
  if(item.track_inventory&&old+1>availableAt(item)){setBarcodeMessage(`Not enough stock at this location for ${item.name}.`);return;}
  setBasket(current=>current.some(x=>x.product_id===item.id)?current.map(x=>x.product_id===item.id?{...x,quantity:x.quantity+1}:x):[...current,{product_id:item.id,quantity:1}]);
  setBarcodeMessage(`${item.name} added. Prices are rechecked at checkout.`);setBarcode('');barcodeInputRef.current?.focus();
 };
 const restoreHeld=(cart:HeldCart)=>{
  const lines=cart.basket;
  if(!Array.isArray(lines)||lines.some(x=>!x||typeof x!=='object'||typeof x.product_id!=='string'||typeof x.quantity!=='number')){
   setSavedMessage('Saved cart contains invalid items.');return;
  }
  if(!locations.some(l=>l.id===cart.location_id)){setSavedMessage('This saved stock location is no longer available.');return;}
  setLocationId(cart.location_id);setBasket(lines);setCustomerId(cart.customer_id||'');
  setPriceMode(cart.price_mode==='inclusive'?'inclusive':'exclusive');setDiscount(String(cart.discount||0));
  setTenderMode('single');setPaid(false);setRequestId(crypto.randomUUID());setSavedMessage('Cart restored. Check current stock, pricing and tax before taking payment.');
 };
 const hold=()=>{
  setSavedMessage('');if(!basket.length){setSavedMessage('Add products before holding this cart.');return;}
  const label=heldLabel.trim()||`Cart ${new Date().toLocaleTimeString('en-NG')}`;
  const cartId=crypto.randomUUID();
  startSave(async()=>{const result=await savePosCart({id:cartId,label,locationId,customerId,basket,priceMode,discount:Number(discount)||0});
   setSavedMessage(result.message);if(result.ok){setBasket([]);setHeldLabel('');router.refresh();}});
 };
 const removeHeld=(id:string)=>startSave(async()=>{const result=await discardPosCart(id);setSavedMessage(result.message);if(result.ok)router.refresh()});
 const adjust=(id:string,delta:number)=>{
  const item=products.find(p=>p.id===id);
  if(!item)return;
  setBasket(current=>current.flatMap(line=>{
   if(line.product_id!==id)return [line];
   const next=Math.round((line.quantity+delta)*1000)/1000;
   if(next<=0)return [];
   if(next>1000000||(item.track_inventory&&next>availableAt(item)))return [line];
   return [{...line,quantity:next}];
  }));
 };
 const add=()=>{
  const p=products.find(p=>p.id===product),q=Number(quantity);if(!p||!Number.isFinite(q)||q<=0||q>1000000||Math.abs(Math.round(q*1000)-q*1000)>1e-6)return;
  const old=basket.find(x=>x.product_id===p.id)?.quantity||0;
  if(p.track_inventory&&q+old>availableAt(p))return;
  setBasket(curr=>curr.some(x=>x.product_id===p.id)?curr.map(x=>x.product_id===p.id?{...x,quantity:x.quantity+q}:x):curr.length<30?[...curr,{product_id:p.id,quantity:q}]:curr);
 };
 return <div className="bo-pos-layout">
  <section className="card card-pad"><h2>Sale basket</h2><p className="small muted">Prices and tax rules are checked against the database when the order is submitted. Display amounts are estimates.</p>
   <div className="bo-pos-scan"><label>Scan or enter barcode / SKU<input ref={barcodeInputRef} value={barcode} onChange={e=>{setBarcode(e.target.value);if(barcodeMessage)setBarcodeMessage('')}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();scan()}}} placeholder="Scan SKU and press Enter" autoComplete="off"/></label><button type="button" className="btn btn-primary" onClick={scan}>Add scanned item</button><button type="button" className="btn" onClick={()=>barcodeInputRef.current?.focus()}>Focus scanner</button></div>
   {barcodeMessage&&<p role="status" className="small muted">{barcodeMessage}</p>}
   <p className="small muted">Works with USB/Bluetooth barcode scanners that type a code, or manual entry. Set the product SKU to its barcode. Only currently loaded products are searchable.</p>
   <label>Find product or service <input type="search" value={query} onChange={e=>{const next=e.target.value;setQuery(next);setProduct(products.find(p=>(p.name+' '+(p.sku||'')).toLowerCase().includes(next.toLowerCase()))?.id||'')}} placeholder="Search catalogue"/></label>
   <div className="bo-pos-add"><label>Item <select value={product} onChange={e=>setProduct(e.target.value)} aria-label="Product"><option value="">Select item</option>{displayed.map(p=><option key={p.id} value={p.id}>{p.name} · {money(p.selling_price)}{p.track_inventory?` · ${p.stock_quantity} available`:''}</option>)}</select></label><label>Qty<input type="number" value={quantity} min="0.001" max="1000000" step="0.001" onChange={e=>setQuantity(e.target.value)}/></label><button type="button" className="btn" disabled={!product||basket.length>=30&&!basket.some(x=>x.product_id===product)} onClick={add}>Add item</button></div>
   <div className="bo-pos-mobile-next"><span>{basket.length} product types in basket</span><a className="btn btn-primary" href="#checkout-payment-panel">Continue to payment ↓</a></div>
   <section className="bo-pos-hold"><h3>Hold cart for later</h3><p className="small muted">Cart contents are stored for this cashier only. Holding a cart does not reserve stock or freeze prices.</p>
    <div className="bo-pos-hold-line"><input aria-label="Held cart name" value={heldLabel} onChange={e=>setHeldLabel(e.target.value)} maxLength={80} placeholder="Customer or cart reference"/><button type="button" className="btn" onClick={hold} disabled={saving||!basket.length}>Hold cart</button></div>
    {heldCarts.length>0&&<div className="bo-pos-held-list">{heldCarts.map(c=><div className="bo-pos-held-row" key={c.id}><div><strong>{c.label}</strong><p className="small muted">{new Date(c.updated_at).toLocaleString('en-NG')}</p></div><div className="bo-pos-held-actions"><button type="button" className="btn" onClick={()=>restoreHeld(c)} disabled={saving}>Resume</button><button type="button" className="btn" onClick={()=>removeHeld(c.id)} disabled={saving}>Discard</button></div></div>)}</div>}
    {savedMessage&&<p role="status" className="small muted">{savedMessage}</p>}
   </section>
   <div className="table-wrap"><table className="table"><thead><tr><th>Item</th><th>Qty</th><th>Amount</th><th></th></tr></thead><tbody>{basket.map(line=>{const item=products.find(p=>p.id===line.product_id);return <tr key={line.product_id}><td>{item?.name||'Item'}{taxMode==='reviewed'&&<p className="small muted">{productTax[line.product_id]?.ready?productTax[line.product_id].treatment.replaceAll('_',' '):'VAT classification required'}</p>}</td><td><div className="bo-pos-quantity-control"><button type="button" aria-label={`Remove one ${item?.name||'item'}`} onClick={()=>adjust(line.product_id,-1)}>−</button><span>{line.quantity}</span><button type="button" aria-label={`Add one ${item?.name||'item'}`} onClick={()=>adjust(line.product_id,1)}>+</button></div></td><td>{money((item?.selling_price||0)*line.quantity)}</td><td><button type="button" className="btn" onClick={()=>setBasket(current=>current.filter(x=>x.product_id!==line.product_id))} aria-label={`Remove ${item?.name||'item'}`}>Remove</button></td></tr>})}</tbody></table>{!basket.length&&<p className="muted">Add products or services to begin a sale.</p>}</div>
  </section>
  <section className="card card-pad" id="checkout-payment-panel"><h2>Checkout</h2><label>Stock location<select value={locationId} onChange={e=>{if(basket.length&&!window.confirm('Changing the stock location clears the current basket. Continue?'))return;setLocationId(e.target.value);setBasket([])}} required>{locations.map(l=><option value={l.id} key={l.id}>{l.name}{l.is_unallocated?' (receiving / unallocated)':''}</option>)}</select></label><p className="small muted">Tracked stock must exist in the selected location. Changing the location clears the basket to prevent selling stock from another branch.</p><form action={action} className="comms-form">
   <input type="hidden" name="location_id" value={locationId}/><input type="hidden" name="request_id" value={requestId}/><input type="hidden" name="basket" value={JSON.stringify(basket)}/><input type="hidden" name="payment_mode" value={tenderMode}/><input type="hidden" name="tenders" value={JSON.stringify(tenders.map(t=>({method:t.method,amount:Number(t.amount),reference:t.reference})))}/>
   {taxMode==='reviewed'&&<><label>Catalogue price basis<select name="price_mode" value={priceMode} onChange={e=>setPriceMode(e.target.value as PosPriceMode)}><option value="exclusive">Prices exclude VAT</option><option value="inclusive">Prices include VAT</option></select></label><p className="small muted">Choose how product selling prices were entered. Inclusive prices are converted to pre-tax values before VAT is assessed; zero-rated and exempt items retain their original values. This setting applies to the whole basket.</p><label>Pre-tax discount (₦)<input name="discount" value={discount} inputMode="decimal" onChange={e=>setDiscount(e.target.value)} placeholder="0.00" aria-describedby="pos-discount-info" /></label><p className="small muted" id="pos-discount-info">The discount reduces the taxable value proportionally across all items, including zero-rated items. VAT is recalculated after the discount. The final amount is verified by the database.</p></>}
   <label>Customer (optional)<select name="customer" value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">Walk-in customer</option>{customers.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
   <label>Payment status<select value={paid?'yes':'no'} onChange={e=>{setPaid(e.target.value==='yes');if(e.target.value==='no')setTenderMode('single')}} name="paid"><option value="yes">Payment already received</option><option value="no">Not paid / pay later</option></select></label>
   {paid&&<label>Payment recording<select value={tenderMode} onChange={e=>setTenderMode(e.target.value as 'single'|'split')}><option value="single">One method · full payment</option><option value="split">Split across 2 or 3 methods · full or part payment</option></select></label>}
   {paid&&tenderMode==='split'&&<section className="bo-pos-split"><h3>Recorded payment methods</h3><p className="small muted">Enter 2–3 verified amounts already received. The total must not exceed the database-calculated sale total. These are recorded payments, not bank transactions.</p>
     {tenders.map((t,i)=><div className="bo-pos-tender-row" key={i}><label>Method {i+1}<select value={t.method} onChange={e=>setTenders(prev=>prev.map((v,j)=>j===i?{...v,method:e.target.value as Tender['method']}:v))}><option value="cash">Cash</option><option value="transfer">Bank transfer</option><option value="pos">External POS</option><option value="card">External card</option><option value="other">Other</option></select></label><label>Amount (₦)<input value={t.amount} onChange={e=>setTenders(prev=>prev.map((v,j)=>j===i?{...v,amount:e.target.value}:v))} inputMode="decimal" placeholder="0.00"/></label><label>Reference<input value={t.reference} onChange={e=>setTenders(prev=>prev.map((v,j)=>j===i?{...v,reference:e.target.value}:v))} maxLength={150}/></label></div>)}
     <div className="bo-pos-total"><span>Recorded tenders</span><strong>{money(tenderSum)}</strong></div><div className="bo-pos-total"><span>Estimated outstanding</span><strong>{money(Math.max(0,totalPayable-tenderSum))}</strong></div>
     <button type="button" className="btn" disabled={tenders.length>=3} onClick={()=>setTenders(prev=>[...prev,{method:'cash',amount:'',reference:''}])}>Add third method</button> {tenders.length===3&&<button className="btn" type="button" onClick={()=>setTenders(prev=>prev.slice(0,2))}>Remove third method</button>}
     {invalidTenders&&<p role="alert" className="negative">All amounts must be positive, with up to two decimals, and cannot exceed the estimated total.</p>}
    </section>}
   {paid&&tenderMode==='single'&&<><label>Recorded method<select name="method"><option value="cash">Cash</option><option value="transfer">Bank transfer</option><option value="pos">External POS terminal</option><option value="card">External card payment</option><option value="other">Other</option></select></label><label>Reference (optional)<input name="reference" maxLength={150} placeholder="Bank transfer reference"/></label></>}
   <div className="bo-pos-total"><span>{taxMode==='reviewed'?'Subtotal before VAT':'Subtotal (tax unverified)'}</span><strong>{money(taxMode==='reviewed'?pricing.subtotal:total)}</strong></div>
   {taxMode==='reviewed'&&pricing.discount>0&&<div className="bo-pos-total"><span>Pre-tax discount</span><strong>− {money(pricing.discount)}</strong></div>}
   {taxMode==='reviewed'?<><div className="bo-pos-total"><span>Approved VAT estimate</span><strong>{money(vat)}</strong></div><div className="bo-pos-total"><span>Total including VAT</span><strong>{money(totalPayable)}</strong></div>{invalidTax&&<p role="alert" className="negative">Every item needs a current approved VAT classification before checkout. Ask the owner to link the product in POS Tax Setup.</p>}{invalidDiscount&&<p role="alert" className="negative">Enter a valid discount smaller than the pre-tax basket subtotal (up to two decimal places).</p>}</>:<p className="small muted">VAT has not been reviewed for this business. No automatic tax is included in this checkout.</p>}
   <p className="small muted">Payment selection records an already received payment. BusinessOS does not charge cards or confirm bank transfers.</p>
   <button className="btn btn-primary" type="submit" disabled={pending||!locationId||!requestId||!basket.length||total<=0||invalidTax||invalidDiscount||invalidTenders}>{pending?'Saving checkout…':'Complete checkout'}</button>
   {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
   {state.ok&&state.orderId&&<div className="bo-pos-held-actions"><Link href={`/pos/receipts/${state.orderId}`} className="btn btn-primary">Print POS receipt</Link><Link href={`/orders/${state.orderId}`} className="btn">View order</Link></div>}
  </form></section>
 </div>;
}
