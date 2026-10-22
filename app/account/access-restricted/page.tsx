import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getServerSupabase} from '@/lib/server/supabase';

export const dynamic='force-dynamic';
export default async function AccessRestrictedPage(){
 const client=await getServerSupabase();
 if(!client)redirect('/login');
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||!user)redirect('/login');
 const {data:blocked,error}=await client.rpc('my_blocked_membership_exists');
 if(!error&&blocked===false)redirect('/dashboard');
 return <main className="auth"><section className="auth-card" role="status">
  <h1>{error?'We could not confirm your workspace access':'This business workspace is unavailable'}</h1>
  <p>{error?'Your access status is temporarily unavailable. Please contact support before trying again.':
   'Your previous business membership is no longer active, or the business is unavailable. Your account has not been deleted and your records have not been erased.'}</p>
  <p className="muted">If access should be restored, contact your business owner or BusinessOS support. Do not create a replacement workspace to access another business’s records.</p>
  <p style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:20}}>
   <Link href="/account/deletion-request" className="btn">Account and privacy requests</Link>
   <Link href="/logout" className="btn btn-primary">Sign out</Link>
  </p>
 </section></main>;
}
