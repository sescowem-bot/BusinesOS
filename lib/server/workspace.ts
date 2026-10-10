import 'server-only';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {getServerSupabase} from './supabase';
import {ACTIVE_BUSINESS_COOKIE} from './workspace-selection';

export async function getWorkspace(){
 const client=await getServerSupabase();
 if(!client)redirect('/login');
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||!user)redirect('/login');
 const requestedBusinessId=(await cookies()).get(ACTIVE_BUSINESS_COOKIE)?.value;
 let member: {business_id:string;role:string}|null=null;
 // The cookie is untrusted. Selecting a business requires a real membership row.
 if(requestedBusinessId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedBusinessId)){
  const selected=await client.from('business_members').select('business_id,role')
   .eq('user_id',user.id).eq('business_id',requestedBusinessId).maybeSingle();
  if(selected.error)throw new Error('Workspace permissions cannot be verified. Contact platform support.');
  if(selected.data)member=selected.data;
 }
 if(!member){
  const result=await client.from('business_members').select('business_id,role')
   .eq('user_id',user.id).order('created_at',{ascending:true}).limit(1).maybeSingle();
  if(result.error)throw new Error('Workspace permissions cannot be verified. Contact platform support.');
  member=result.data;
 }
 if(!member){
  const {data:admin,error:adminError}=await client.from('platform_admins').select('user_id').eq('user_id',user.id).eq('active',true).maybeSingle();
  if(adminError)throw new Error('Platform role could not be verified. Contact support.');
  if(admin)redirect('/admin/my-business');
  redirect('/onboarding');
 }
 return {client,businessId:member.business_id,role:member.role,userId:user.id};
}
