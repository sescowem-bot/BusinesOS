import 'server-only';
import {redirect} from 'next/navigation';
import {getServerSupabase} from './supabase';
export async function getWorkspace(){
 const client=await getServerSupabase();
 if(!client)redirect('/login');
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||!user)redirect('/login');
 const {data:member,error:memberError}=await client.from('business_members')
  .select('business_id,role').eq('user_id',user.id).order('created_at',{ascending:true}).limit(1).maybeSingle();
 if(memberError)throw new Error('Workspace permissions cannot be verified. Contact platform support.');
 if(!member){
  const {data:admin,error:adminError}=await client.from('platform_admins').select('user_id').eq('user_id',user.id).eq('active',true).maybeSingle();
  if(adminError)throw new Error('Platform role could not be verified. Contact support.');
  if(admin)redirect('/admin');
  redirect('/onboarding');
 }
 return {client,businessId:member.business_id as string,role:member.role as string,userId:user.id};
}
