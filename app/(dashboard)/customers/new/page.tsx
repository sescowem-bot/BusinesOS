'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowLeft,Save} from 'lucide-react';
import {useBusiness} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';

export default function NewCustomer(){
  const router=useRouter();
  const{business}=useBusiness();
  const[name,setName]=useState('');
  const[phone,setPhone]=useState('');
  const[email,setEmail]=useState('');
  const[notes,setNotes]=useState('');
  const[error,setError]=useState<string|null>(null);
  const[saving,setSaving]=useState(false);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setError(null);
    if(!business){setError('No business found for your account yet.');return}
    const supabase=getSupabaseBrowser();
    if(!supabase){setError('Supabase is not configured.');return}
    setSaving(true);
    const{data:customer,error:custErr}=await supabase.from('customers').insert({name,phone,email:email||null,notes:notes||null}).select('id').single();
    if(custErr){setSaving(false);setError(custErr.message);return}
    const{error:linkErr}=await supabase.from('business_customers').insert({business_id:business.id,customer_id:customer.id});
    setSaving(false);
    if(linkErr){setError(linkErr.message);return}
    router.push('/customers');
    router.refresh();
  }

  return <><div className="page-head"><div><Link href="/customers" className="back-link"><ArrowLeft size={15}/> Customers</Link><h1>New customer</h1><p>Save customer details once and build their history over time.</p></div></div><form onSubmit={submit} className="form-card"><div className="form-grid"><div className="field"><label>Full name</label><input required value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Ada Okafor"/></div><div className="field"><label>Phone</label><input required value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+234 800 000 0000"/></div><div className="field"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="customer@example.com"/></div><div className="field full"><label>Notes</label><textarea rows={5} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Preferences, delivery information or other useful notes."/></div></div>{error&&<p className="small" style={{color:'#d92d20'}}>{error}</p>}<div className="form-actions"><Link href="/customers" className="btn">Cancel</Link><button type="submit" className="btn btn-primary" disabled={saving}><Save size={15}/> {saving?'Saving...':'Save customer'}</button></div></form></>;
}
