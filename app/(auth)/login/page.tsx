import {getServerSupabase} from '@/lib/server/supabase';
import {isActivePlatformAdmin} from '@/lib/server/viewer-access';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import LoginForm from './login-form';
import {getPlatformBrand} from '@/lib/server/branding';
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}){
 const {error:loginError}=await searchParams;const client=await getServerSupabase();if(client){const {data:{user},error}=await client.auth.getUser();if(!error&&user){if(await isActivePlatformAdmin(client,user.id))redirect('/admin');const member=await client.from('business_members').select('business_id').eq('user_id',user.id).limit(1);if(!member.error&&member.data?.length)redirect('/dashboard');if(!member.error)redirect('/onboarding');}}const brand=await getPlatformBrand();return <main className="auth"><div className="auth-card auth-card-accessible"><div className="brand"><span className="brand-mark">{brand.logo_url?<img src={brand.logo_url} alt="" width={35} height={35} style={{objectFit:'contain'}}/>:brand.short_name[0]?.toUpperCase()}</span><span>{brand.name}</span></div><h1>Welcome back</h1><p className="muted">Sign in to your account.</p>{loginError==='callback'&&<div className="auth-feedback auth-feedback-error" role="alert"><strong>That verification link could not be completed.</strong><p>It may have expired or already been used. Check the original email or request a new password reset link.</p><Link href="/forgot-password">Request a new link →</Link></div>}
 {loginError==='config'&&<div className="auth-feedback auth-feedback-error" role="alert">Authentication is temporarily unavailable. Please contact support.</div>}
 <LoginForm/><p className="small muted" style={{marginTop:18}}>Business accounts use a secure login. Platform administrator access is granted separately.</p><Link className="small" href="/">Return to website</Link></div></main>}
