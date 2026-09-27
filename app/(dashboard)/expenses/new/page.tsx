'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowLeft,Save} from 'lucide-react';
import {useBusiness} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';

export default function NewExpense(){
  const router=useRouter();
  const{business}=useBusiness();
  const[description,setDescription]=useState('');
  const[category,setCategory]=useState('');
  const[amount,setAmount]=useState('');
  const[date,setDate]=useState(()=>new Date().toISOString().slice(0,10));
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
      const{data:catId,error:catErr}=await supabase.rpc('get_or_create_expense_category',{p_business_id:business.id,p_name:category.trim()});
      if(catErr){setSaving(false);setError(catErr.message);return}
      categoryId=catId;
    }
    const{error:insErr}=await supabase.from('expenses').insert({business_id:business.id,category_id:categoryId,description,amount:Number(amount)||0,paid_at:new Date(date).toISOString()});
    setSaving(false);
    if(insErr){setError(insErr.message);return}
    router.push('/expenses');
    router.refresh();
  }

  return <><div className="page-head"><div><Link href="/expenses" className="back-link"><ArrowLeft size={15}/> Expenses</Link><h1>Add expense</h1><p>Record money your business has spent.</p></div></div><form onSubmit={submit} className="form-card"><div className="form-grid"><div className="field full"><label>Description</label><input required value={description} onChange={e=>setDescription(e.target.value)} placeholder="e.g. Deliveries, packaging, electricity"/></div><div className="field"><label>Category</label><input value={category} onChange={e=>setCategory(e.target.value)} placeholder="e.g. Transport"/></div><div className="field"><label>Amount</label><input required type="number" min="0" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"/></div><div className="field"><label>Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div></div>{error&&<p className="small" style={{color:'#d92d20'}}>{error}</p>}<div className="form-actions"><Link href="/expenses" className="btn">Cancel</Link><button className="btn btn-primary" type="submit" disabled={saving}><Save size={15}/> {saving?'Saving...':'Save expense'}</button></div></form></>;
}
