import 'server-only';
import {redirect} from 'next/navigation';
import {getServerSupabase} from './supabase';
export async function getWorkspace(){
 const client=await getServerSupabase();if(!client)redirect('/login');
 const {data:{user},error}=await client.auth.getUser();if(error||!user)redirect('/login');
 const {data:member,error:memberError}=await client.from('business_members').select('business_id,role').eq('user_id',user.id).order('created_at',{ascending:true}).limit(1).maybeSingle();
 if(memberError)throw new Error('Workspace access unavailable');if(!member)redirect('/onboarding');
 return {client,businessId:member.business_id as string,role:member.role as string};
}
