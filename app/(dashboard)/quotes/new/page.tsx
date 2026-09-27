'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowLeft,Save,Plus,Trash2} from 'lucide-react';
import {useBusiness,nextQuoteNumber} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';
import {money} from '@/lib/format';

type CustomerOpt={id:string;name:string};
type ProductOpt={id:string;name:string;selling_price:number};
type Line={productId:string;name:string;quantity:number;unitPrice:number};

export default function NewQuote(){
  const router=useRouter();
  const{business}=useBusiness();
  const[customers,setCustomers]=useState<CustomerOpt[]>([]);
  const[products,setProducts]=useState<ProductOpt[]>([]);
  const[customerId,setCustomerId]=useState('');
  const[lines,setLines]=useState<Line[]>([]);
  const[discount,setDiscount]=useState('0');
  const[tax,setTax]=useState('0');
  const[expiresAt,setExpiresAt]=useState('');
  const[error,setError]=useState<string|null>(null);
  const[saving,setSaving]=useState(false);

  useEffect(()=>{
    if(!business)return;
    (async()=>{
      const supabase=getSupabaseBrowser();
      if(!supabase)return;
      const[{data:links},{data:prods}]=await Promise.all([
        supabase.from('business_customers').select('customers(id,name)').eq('business_id',business.id),
        supabase.from('products').select('id,name,selling_price').eq('business_id',business.id).eq('active',true)
      ]);
      setCustomers((links||[]).map((l:any)=>l.customers).filter(Boolean));
      setProducts(prods||[]);
    })();
  },[business]);

  function addLine(){setLines(l=>[...l,{productId:'',name:'',quantity:1,unitPrice:0}])}
  function removeLine(i:number){setLines(l=>l.filter((_,idx)=>idx!==i))}
  function updateLine(i:number,patch:Partial<Line>){setLines(l=>l.map((ln,idx)=>idx===i?{...ln,...patch}:ln))}
  function pickProduct(i:number,productId:string){const p=products.find(x=>x.id===productId);updateLine(i,{productId,name:p?.name||'',unitPrice:p?p.selling_price:0})}

  const subtotal=lines.reduce((s,l)=>s+l.quantity*l.unitPrice,0);
  const total=Math.max(0,subtotal-(Number(discount)||0)+(Number(tax)||0));

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setError(null);
    if(!business){setError('No business found for your account yet.');return}
    if(lines.length===0){setError('Add at least one item to the quote.');return}
    const supabase=getSupabaseBrowser();
    if(!supabase){setError('Supabase is not configured.');return}
    setSaving(true);
    const{data:quote,error:quoteErr}=await supabase.from('quotes').insert({business_id:business.id,customer_id:customerId||null,quote_number:nextQuoteNumber(),status:'draft',subtotal,discount:Number(discount)||0,tax:Number(tax)||0,expires_at:expiresAt||null}).select('id').single();
    if(quoteErr){setSaving(false);setError(quoteErr.message);return}
    const itemRows=lines.map(l=>({quote_id:quote.id,name:l.name||'Item',quantity:l.quantity,unit_price:l.unitPrice}));
    const{error:itemsErr}=await supabase.from('quote_items').insert(itemRows);
    setSaving(false);
    if(itemsErr){setError(itemsErr.message);return}
    router.push(`/quotes/${quote.id}`);
    router.refresh();
  }

  return <><div className="page-head"><div><Link href="/quotes" className="back-link"><ArrowLeft size={15}/> Quotes</Link><h1>New quote</h1><p>Prepare a quote to send to a customer.</p></div></div><form onSubmit={submit} className="form-card"><div className="form-grid"><div className="field"><label>Customer</label><select value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">No customer selected</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="field"><label>Expires</label><input type="date" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)}/></div></div><div style={{height:8}}/><table className="table"><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Line total</th><th></th></tr></thead><tbody>{lines.map((l,i)=><tr key={i}><td><select value={l.productId} onChange={e=>pickProduct(i,e.target.value)} style={{minWidth:180}}><option value="">Custom item</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>{!l.productId&&<input placeholder="Item name" value={l.name} onChange={e=>updateLine(i,{name:e.target.value})} style={{marginTop:6,width:'100%'}}/>}</td><td><input type="number" min="0.001" step="0.001" value={l.quantity} onChange={e=>updateLine(i,{quantity:Number(e.target.value)||0})} style={{width:80}}/></td><td><input type="number" min="0" value={l.unitPrice} onChange={e=>updateLine(i,{unitPrice:Number(e.target.value)||0})} style={{width:120}}/></td><td>{money(l.quantity*l.unitPrice)}</td><td><button type="button" className="btn" onClick={()=>removeLine(i)}><Trash2 size={14}/></button></td></tr>)}</tbody></table><div style={{padding:'12px 0'}}><button type="button" className="btn" onClick={addLine}><Plus size={14}/> Add item</button></div><div className="form-grid"><div className="field"><label>Discount</label><input type="number" min="0" value={discount} onChange={e=>setDiscount(e.target.value)}/></div><div className="field"><label>Tax</label><input type="number" min="0" value={tax} onChange={e=>setTax(e.target.value)}/></div></div><div className="subhead"><b>Subtotal: {money(subtotal)}</b><b>Total: {money(total)}</b></div>{error&&<p className="small" style={{color:'#d92d20'}}>{error}</p>}<div className="form-actions"><Link href="/quotes" className="btn">Cancel</Link><button className="btn btn-primary" type="submit" disabled={saving}><Save size={15}/> {saving?'Saving...':'Save quote'}</button></div></form></>;
}
