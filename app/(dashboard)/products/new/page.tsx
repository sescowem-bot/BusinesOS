'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowLeft,Save} from 'lucide-react';
import {useBusiness} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';

export default function NewProduct(){
  const router=useRouter();
  const{business}=useBusiness();
  const[name,setName]=useState('');
  const[sku,setSku]=useState('');
  const[category,setCategory]=useState('');
  const[price,setPrice]=useState('');
  const[cost,setCost]=useState('');
  const[stock,setStock]=useState('0');
  const[minStock,setMinStock]=useState('0');
  const[description,setDescription]=useState('');
  const[error,setError]=useState<string|null>(null);
  const[saving,setSaving]=useState(false);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setError(null);
    if(!business){setError('No business found for your account yet.');return}
    const supabase=getSupabaseBrowser();
    if(!supabase){setError('Supabase is not configured.');return}
    setSaving(true);
    let categoryId:string|null=null;
    if(category.trim()){
      const{data:catId,error:catErr}=await supabase.rpc('get_or_create_product_category',{p_business_id:business.id,p_name:category.trim()});
      if(catErr){setSaving(false);setError(catErr.message);return}
      categoryId=catId;
    }
    const{error:insErr}=await supabase.from('products').insert({business_id:business.id,category_id:categoryId,name,sku:sku||null,description:description||null,selling_price:Number(price)||0,cost_price:Number(cost)||0,stock_quantity:Number(stock)||0,minimum_stock:Number(minStock)||0});
    setSaving(false);
    if(insErr){setError(insErr.message);return}
    router.push('/products');
    router.refresh();
  }

  return <><div className="page-head"><div><Link href="/products" className="back-link"><ArrowLeft size={15}/> Products & services</Link><h1>Add offering</h1><p>Create a product or service you sell.</p></div></div><form onSubmit={submit} className="form-card"><div className="form-grid"><div className="field full"><label>Name</label><input required value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Brown leather heels"/></div><div className="field"><label>SKU</label><input value={sku} onChange={e=>setSku(e.target.value)} placeholder="e.g. SNK-001"/></div><div className="field"><label>Category</label><input value={category} onChange={e=>setCategory(e.target.value)} placeholder="e.g. Footwear"/></div><div className="field"><label>Selling price</label><input required type="number" min="0" value={price} onChange={e=>setPrice(e.target.value)} placeholder="45000"/></div><div className="field"><label>Cost</label><input type="number" min="0" value={cost} onChange={e=>setCost(e.target.value)} placeholder="25000"/></div><div className="field"><label>Stock quantity</label><input type="number" min="0" value={stock} onChange={e=>setStock(e.target.value)}/></div><div className="field"><label>Low-stock level</label><input type="number" min="0" value={minStock} onChange={e=>setMinStock(e.target.value)}/></div><div className="field full"><label>Description</label><textarea rows={5} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe what you sell and what customers should know."/></div></div>{error&&<p className="small" style={{color:'#d92d20'}}>{error}</p>}<div className="form-actions"><Link href="/products" className="btn">Cancel</Link><button className="btn btn-primary" type="submit" disabled={saving}><Save size={15}/> {saving?'Saving...':'Save offering'}</button></div></form></>;
}
