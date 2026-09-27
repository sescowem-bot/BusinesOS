'use client';
import Link from 'next/link';
import {Suspense,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {ArrowRight,LockKeyhole,Mail} from 'lucide-react';
import {getSupabaseBrowser} from '@/lib/supabase';

export default function Login(){
  return <Suspense fallback={null}><LoginForm/></Suspense>;
}

function LoginForm(){
  const router=useRouter();
  const params=useSearchParams();
  const[email,setEmail]=useState('');
  const[password,setPassword]=useState('');
  const[error,setError]=useState<string|null>(null);
  const[loading,setLoading]=useState(false);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setError(null);
    const supabase=getSupabaseBrowser();
    if(!supabase){setError('Supabase is not configured for this deployment.');return}
    setLoading(true);
    const{error:signInError}=await supabase.auth.signInWithPassword({email,password});
    setLoading(false);
    if(signInError){setError(signInError.message);return}
    router.push(params.get('next')||'/dashboard');
    router.refresh();
  }

  return <main className="auth auth-blue"><div className="auth-card"><Link href="/" className="brand"><span className="brand-mark">B</span><span className="brand-text">BusinessOS</span></Link><h1>Welcome back</h1><p className="muted">Sign in to continue managing your business.</p><form onSubmit={submit} className="form-stack"><div className="field"><label>Email address</label><div className="input-icon"><Mail size={16}/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@business.com"/></div></div><div className="field"><label>Password</label><div className="input-icon"><LockKeyhole size={16}/><input required type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/></div></div>{error&&<p className="small" style={{color:'#d92d20'}}>{error}</p>}<div className="auth-row"><label className="check"><input type="checkbox"/> Remember me</label><a href="#" className="small link">Forgot password?</a></div><button className="btn btn-primary btn-block" type="submit" disabled={loading}>{loading?'Signing in...':'Sign in'} <ArrowRight size={15}/></button></form><p className="auth-foot">New to BusinessOS? <Link href="/signup" className="link">Create an account</Link></p></div></main>;
}
