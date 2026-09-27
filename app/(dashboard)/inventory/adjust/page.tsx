'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowLeft,Save} from 'lucide-react';
import {useBusiness} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';

type ProductOpt={id:string;name:string;stock_quantity:number};

export default function StockAdjustment(){
  const router=useRouter();
  const{business}=useBusiness();
  const[products,setProducts]=useState<ProductOpt[]>([]);
  const[productId,setProductId]=useState('');
  const[type,setType]=useState<'purchase'|'return'|'damage'|'adjustment'>('purchase');
  const[quantity,setQuantity]=useState('');
  const[notes,setNotes]=useState('');
  const[error,setError]=useState<string|null>(null);
  const[saving,setSaving]=useState(false);

  useEffect(()=>{
    if(!business)return;
    (async()=>{
      const supabase=getSupabaseBrowser();
      if(!supabase)return;
      const{data}=await supabase.from('products').select('id,name,stock_quantity').eq('business_id',business.id).eq('active',true).order('name');
      setProducts(data||[]);
    })();
  },[business]);

  const selected=products.find(p=>p.id===productId);
  const direction=type==='damage'?-1:1;

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setError(null);
    if(!business||!selected){setError('Choose a product to adjust.');return}
    const supabase=getSupabaseBrowser();
    if(!supabase){setError('Supabase is not configured.');return}
    const qty=Number(quantity)||0;
    if(qty<=0){setError('Enter a quantity greater than zero.');return}
    setSaving(true);
    const signedQty=direction*qty;
    const newStock=Math.max(0,Number(selected.stock_quantity)+signedQty);
    const{error:updErr}=await supabase.from('products').update({stock_quantity:newStock}).eq('id',selected.id);
    if(updErr){setSaving(false);setError(updErr.message);return}
    const{error:movErr}=await supabase.from('inventory_movements').insert({business_id:business.id,product_id:selected.id,movement_type:type,quantity:signedQty,notes:notes||null});
    setSaving(false);
    if(movErr){setError(movErr.message);return}
    router.push('/inventory');
    router.refresh();
  }

  return <><div className="page-head"><div><Link href="/inventory" className="back-link"><ArrowLeft size={15}/> Inventory</Link><h1>Stock adjustment</h1><p>Record stock coming in, going out, or corrections.</p></div></div><form onSubmit={submit} className="form-card"><div className="form-grid"><div className="field full"><label>Product</label><select required value={productId} onChange={e=>setProductId(e.target.value)}><option value="">Select a product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} (current stock {p.stock_quantity})</option>)}</select></div><div className="field"><label>Movement type</label><select value={type} onChange={e=>setType(e.target.value as typeof type)}><option value="purchase">Stock received (purchase)</option><option value="return">Customer return</option><option value="damage">Damage / loss</option><option value="adjustment">Manual correction</option></select></div><div className="field"><label>Quantity</label><input required type="number" min="0.001" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)}/></div><div className="field full"><label>Notes</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional note"/></div></div>{error&&<p className="small" style={{color:'#d92d20'}}>{error}</p>}<div className="form-actions"><Link href="/inventory" className="btn">Cancel</Link><button className="btn btn-primary" type="submit" disabled={saving}><Save size={15}/> {saving?'Saving...':'Save adjustment'}</button></div></form></>;
}
