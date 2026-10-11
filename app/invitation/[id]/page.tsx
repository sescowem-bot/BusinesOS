import Link from 'next/link';
import {getServerSupabase} from '@/lib/server/supabase';
import {joinBusiness} from './actions';
export default async function InvitationPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return <main className="auth"><section className="auth-card"><h1>Invalid invitation</h1><p>Ask your business owner for a new invitation.</p></section></main>;
 const client=await getServerSupabase();
 const {data:{user}}=client?await client.auth.getUser():{data:{user:null}};
 return <main className="auth"><section className="auth-card"><h1>Join your business team</h1><p>Use the same email address your business owner invited. Your access will be based on the role they assigned.</p>{user?<form action={joinBusiness}><input type="hidden" name="invitation_id" value={id}/><button type="submit" className="btn btn-primary">Accept invitation</button></form>:<><p>Already registered? Sign in, then return to this invitation link to join.</p><Link href="/login" className="btn btn-primary">Sign in</Link><Link href="/signup" className="btn">Create an account</Link></>}</section></main>;
}
