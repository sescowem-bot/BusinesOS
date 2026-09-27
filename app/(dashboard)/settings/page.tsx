'use client';
import {useEffect,useState} from 'react';
import {PageHead,Section} from '@/components/ui';
import {useBusiness} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';

type Form={name:string;category:string;city:string;phone:string;whatsapp:string;description:string};

export default function Settings(){
  const{business,loading,refresh}=useBusiness();
  const[form,setForm]=useState<Form>({name:'',category:'Retail',city:'',phone:'',whatsapp:'',description:''});
  const[saved,setSaved]=useState(false);
  const[error,setError]=useState<string|null>(null);
  const[saving,setSaving]=useState(false);

  useEffect(()=>{
    if(business)setForm({name:business.name,category:business.category,city:business.city||'',phone:business.phone||'',whatsapp:business.whatsapp||'',description:business.description||''});
  },[business]);

  function update<K extends keyof Form>(k:K,v:Form[K]){setForm(x=>({...x,[k]:v}));setSaved(false)}

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setError(null);
    if(!business)return;
    const supabase=getSupabaseBrowser();
    if(!supabase){setError('Supabase is not configured.');return}
    setSaving(true);
    const{error:updErr}=await supabase.from('businesses').update({name:form.name,category:form.category,city:form.city||null,phone:form.phone||null,whatsapp:form.whatsapp||null,description:form.description||null}).eq('id',business.id);
    setSaving(false);
    if(updErr){setError(updErr.message);return}
    setSaved(true);
    refresh();
  }

  if(loading)return <div className="empty">Loading...</div>;
  if(!business)return <div className="empty">No business found for your account yet.</div>;

  return <><PageHead title="Settings" description="Configure your business identity and workspace preferences."/><form onSubmit={submit}><div className="grid grid-2"><Section title="Business profile"><div className="form-grid"><div className="field full"><label>Business name</label><input value={form.name} onChange={e=>update('name',e.target.value)} required/></div><div className="field"><label>Category</label><select value={form.category} onChange={e=>update('category',e.target.value)}><option>Retail</option><option>Fashion</option><option>Food</option><option>Electronics</option><option>Services</option><option>Professional</option><option>Manufacturing</option><option>Other</option></select></div><div className="field"><label>City</label><input value={form.city} onChange={e=>update('city',e.target.value)}/></div><div className="field"><label>Phone</label><input value={form.phone} onChange={e=>update('phone',e.target.value)}/></div><div className="field"><label>WhatsApp</label><input value={form.whatsapp} onChange={e=>update('whatsapp',e.target.value)}/></div><div className="field full"><label>Business description</label><textarea rows={5} value={form.description} onChange={e=>update('description',e.target.value)}/></div></div></Section><Section title="Public business profile"><p className="small muted">When you are ready, this information can power your public marketplace profile. Featured placement will be controlled by your subscription, not by the frontend.</p><div className="profile-preview"><span className="business-logo">{form.name.slice(0,1).toUpperCase()}</span><div><b>{form.name}</b><div className="small muted">{form.category} · {form.city}</div></div></div></Section></div>{error&&<p className="small" style={{color:'#d92d20'}}>{error}</p>}<div className="form-actions"><button className="btn btn-primary" type="submit" disabled={saving}>{saving?'Saving...':'Save business changes'}</button>{saved&&<span className="small positive">Changes saved.</span>}</div></form></>;
}
