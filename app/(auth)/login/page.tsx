import {getServerSupabase} from '@/lib/server/supabase';
import {isActivePlatformAdmin} from '@/lib/server/viewer-access';
import Link from 'next/link';
import LoginForm from './login-form';
import {signOut} from './actions';
import {getPlatformBrand} from '@/lib/server/branding';

export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}){
 const {error:loginError}=await searchParams;
 const [client,brand]=await Promise.all([getServerSupabase(),getPlatformBrand()]);
 if(client){
  const {data:{user},error}=await client.auth.getUser();
  if(!error&&user){
   const admin=await isActivePlatformAdmin(client,user.id);
   const membership=admin?null:await client.from('business_members').select('business_id').eq('user_id',user.id).limit(1);
   const next=admin?'/admin':membership?.data?.length?'/dashboard':'/onboarding';
   return <main className="auth"><section className="auth-card auth-card-accessible">
    <Link className="brand" href="/">{brand.name}</Link>
    <h1>You're signed in</h1>
    <p className="muted">Welcome back. You can continue to your workspace or sign out to use another account.</p>
    <p className="small muted">Signed in as <strong>{user.email||'your account'}</strong></p>
    <Link className="btn btn-primary auth-submit" href={next} style={{display:'flex',alignItems:'center',justifyContent:'center',marginTop:18}}>Continue to {admin?'admin console':'workspace'}</Link>
    <form action={signOut} style={{marginTop:14}}><button type="submit" className="btn" style={{width:'100%'}}>Use another account</button></form>
    <p className="small muted" style={{marginTop:18}}>Using a shared device? Sign out when you're finished.</p>
   </section></main>;
  }
 }
 return <main className="auth"><div className="auth-card auth-card-accessible"><Link href="/" className="brand"><span className="brand-mark">{brand.logo_url?<img src={brand.logo_url} alt="" width={35} height={35} style={{objectFit:'contain'}}/>:brand.short_name[0]?.toUpperCase()}</span><span>{brand.name}</span></Link><h1>Welcome back</h1><p className="muted">Sign in to pick up where you left off.</p>
 {loginError==='callback'&&<div className="auth-feedback auth-feedback-error" role="alert"><strong>Your verification link has expired or was already used.</strong><p>Request a fresh link to continue.</p><Link href="/forgot-password">Get a new link →</Link></div>}
 {loginError==='config'&&<div className="auth-feedback auth-feedback-error" role="alert">Sign-in is temporarily unavailable. Please contact support.</div>}
 <LoginForm/><p className="small muted" style={{marginTop:18}}>{brand.support_email?<a href={`mailto:${brand.support_email}`}>Need help? Contact support</a>:<Link href="/contact">Need help? Contact us</Link>}</p><Link className="small" href="/">Return to website</Link></div></main>;
}
