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
 if(!terms.available)return <main className="auth"><div className="auth-card"><h1>Legal documents temporarily unavailable</h1><p>We cannot complete account activation until the approved terms can be verified. Please try again later or contact support.</p><Link href="/login">Return to sign in</Link></div></main>;
 if(terms.document){
  const {data:acceptance,error}=await client.from('user_legal_acceptances')
   .select('id').eq('user_id',user.id).eq('document_id',terms.document.id).maybeSingle();
  if(error)return <main className="auth"><div className="auth-card"><h1>Agreement verification unavailable</h1><p>We could not confirm the current Terms acceptance. Please try again.</p></div></main>;
  if(!acceptance)return <main className="auth"><div className="auth-card"><Link href="/" className="brand">{b.name}</Link><h1>Review the Terms</h1><TermsAcknowledgement terms={terms.document}/></div></main>;
 }
 const {data:existing}=await client.from('business_members').select('business_id').eq('user_id',user.id).limit(1);
 if(existing?.length)redirect('/dashboard');
 return <main className="auth"><div className="auth-card"><Link href="/" className="brand">{b.name}</Link><h1>Set up your workspace</h1><p className="muted">Tell us a little about your business. Your Free plan and Owner access are set up automatically. You can add more details later.</p><OnboardForm/></div></main>;
}
