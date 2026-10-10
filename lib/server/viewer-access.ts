import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {getServerSupabase} from './supabase';

/** This is a display hint only. All admin pages/actions must independently verify access. */
export async function isActivePlatformAdmin(client:SupabaseClient,userId:string):Promise<boolean>{
 const {data,error}=await client.from('platform_admins').select('user_id').eq('user_id',userId).eq('active',true).maybeSingle();
 return !error&&Boolean(data);
}
import type {ViewerAccess} from '@/lib/viewer-access';
export async function getViewerAccess():Promise<ViewerAccess>{
 const client=await getServerSupabase();
 if(!client)return 'guest';
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user)return 'guest';
 if(await isActivePlatformAdmin(client,user.id))return 'admin';
 const membership=await client.from('business_members').select('business_id').eq('user_id',user.id).limit(1);
 return membership.error?'guest':membership.data?.length?'business':'onboarding';
}
