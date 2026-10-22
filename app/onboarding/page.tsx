import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getServerSupabase} from '@/lib/server/supabase';
import {getPlatformBrand} from '@/lib/server/branding';
import {getActiveTerms} from '@/lib/server/legal-documents';
import OnboardForm from './form';
import TermsAcknowledgement from './terms-form';

export const dynamic='force-dynamic';
export default async function Onboarding(){
 const client=await getServerSupabase();
 if(!client)redirect('/login');
 const {data:{user}}=await client.auth.getUser();
 if(!user)redirect('/login');
 const [terms,b]=await Promise.all([getActiveTerms(),getPlatformBrand()]);
 if(!terms.available)return <main className="auth"><div className="auth-card"><h1>We couldn't continue right now</h1><p>Please try again shortly. If this continues, contact our support team.</p><Link href="/login">Return to sign in</Link></div></main>;
 if(terms.document){
  const {data:acceptance,error}=await client.from('user_legal_acceptances')
   .select('id').eq('user_id',user.id).eq('document_id',terms.document.id).maybeSingle();
  if(error)return <main className="auth"><div className="auth-card"><h1>We couldn't confirm your agreement</h1><p>Please refresh this page and try again.</p></div></main>;
  if(!acceptance)return <main className="auth"><div className="auth-card"><Link href="/" className="brand">{b.name}</Link><h1>One more step</h1><TermsAcknowledgement terms={terms.document}/></div></main>;
 }
 const {data:existing,error:existingError}=await client.from('business_members').select('business_id').eq('user_id',user.id).limit(1);
 if(existingError)return <main className="auth"><div className="auth-card"><h1>Unable to check your workspaces</h1><p>Please refresh or contact support. No new business has been created.</p></div></main>;
 if(existing?.length)redirect('/dashboard');
 const {data:blocked,error:blockedError}=await client.rpc('my_blocked_membership_exists');
 if(!blockedError&&blocked===true)redirect('/account/access-restricted');
 if(blockedError&&!['PGRST202','42883'].includes(blockedError.code))
  return <main className="auth"><div className="auth-card"><h1>Unable to verify account access</h1><p>Please try again or contact support before creating another workspace.</p></div></main>;
 return <main className="auth"><div className="auth-card"><Link href="/" className="brand">{b.name}</Link><h1>Tell us about your business</h1><p className="muted">Just a few details to get your workspace ready. You can update them anytime.</p><OnboardForm/></div></main>;
}
