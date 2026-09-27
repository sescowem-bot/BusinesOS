'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowRight,BriefcaseBusiness,UserRound} from 'lucide-react';
import {getSupabaseBrowser} from '@/lib/supabase';

export default function Signup(){
  const router=useRouter();
  const[role,setRole]=useState<'business'|'customer'>('business');
  const[name,setName]=useState('');
  const[email,setEmail]=useState('');
  const[phone,setPhone]=useState('');
  const[password,setPassword]=useState('');
  const[error,setError]=useState<string|null>(null);
  const[notice,setNotice]=useState<string|null>(null);
  const[loading,setLoading]=useState(false);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setError(null);setNotice(null);
    const supabase=getSupabaseBrowser();
    if(!supabase){setError('Supabase is not configured for this deployment.');return}
    setLoading(true);
    const{data,error:signUpError}=await supabase.auth.signUp({email,password,options:{data:{full_name:name,role}}});
    if(signUpError){setLoading(false);setError(signUpError.message);return}

    if(!data.session){
      setLoading(false);
      setNotice('Account created. Check your email to confirm your address, then sign in to finish setting up your workspace.');
      return;
    }

    if(role==='business'){
      const{error:rpcError}=await supabase.rpc('create_business_with_owner',{p_name:name||'My Business',p_category:'Other',p_phone:phone,p_whatsapp:phone,p_city:null,p_currency:'NGN'});
      if(rpcError){setLoading(false);setError('Account created, but the workspace could not be set up: '+rpcError.message);return}
      setLoading(false);
      router.push('/dashboard');
      router.refresh();
      return;
    }

    setLoading(false);
    router.push('/customer');
    router.refresh();
  }

  return <main className="auth auth-blue"><div className="auth-card auth-wide"><Link href="/" className="brand"><span className="brand-mark">B</span><span className="brand-text">BusinessOS</span></Link><h1>Create your account</h1><p className="muted">Choose how you will use BusinessOS. Start free and upgrade later.</p><div className="role-grid"><button type="button" className={`role-card ${role==='business'?'selected':''}`} onClick={()=>setRole('business')}><BriefcaseBusiness size={20}/><b>Business owner</b><span>Manage sales, customers, orders, payments and profit.</span></button><button type="button" className={`role-card ${role==='customer'?'selected':''}`} onClick={()=>setRole('customer')}><UserRound size={20}/><b>Customer / buyer</b><span>Discover businesses, buy, track orders and view balances.</span></button></div><form onSubmit={submit} className="form-stack"><div className="field"><label>{role==='business'?'Business name':'Full name'}</label><input required value={name} onChange={e=>setName(e.target.value)} placeholder={role==='business'?'e.g. Ada Couture':'e.g. Ada Okafor'}/></div><div className="form-grid"><div className="field"><label>Email address</label><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></div><div className="field"><label>Phone</label><input required value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+234 800 000 0000"/></div></div><div className="field"><label>Password</label><input required type="password" minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/></div>{error&&<p className="small" style={{color:'#d92d20'}}>{error}</p>}{notice&&<p className="small" style={{color:'#067647'}}>{notice}</p>}<button className="btn btn-primary btn-block" type="submit" disabled={loading}>{loading?'Creating account...':'Continue'} <ArrowRight size={15}/></button></form><p className="auth-foot">Already have an account? <Link href="/login" className="link">Sign in</Link></p></div></main>;
}
