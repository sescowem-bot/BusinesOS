'use server';
import {redirect} from 'next/navigation';
import {getServerSupabase} from '@/lib/server/supabase';
export async function joinBusiness(form:FormData){
 const id=String(form.get('invitation_id')||'');
 if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('This invitation link is invalid.');
 const client=await getServerSupabase();
 if(!client)redirect('/login');
 const {data:{user}}=await client.auth.getUser();
 if(!user)redirect('/login');
 const {error}=await client.rpc('accept_team_invitation',{p_invitation_id:id});
 if(error){console.error('[invitation] acceptance failed',error.code);throw new Error('We could not complete your invitation. Make sure you signed in with the invited email address and verified it.');}
 redirect('/dashboard');
}
