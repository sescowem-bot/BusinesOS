import 'server-only';
import {cookies} from 'next/headers';
import {createServerClient} from '@supabase/ssr';

export async function getServerSupabase(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return null;
  const store=await cookies();
  return createServerClient(url,key,{
    cookies:{
      getAll(){return store.getAll()},
      setAll(items){for(const item of items){try{store.set(item.name,item.value,item.options)}catch{ /* Server component: middleware or a server action must refresh the session. */ }}}
    }
  });
}
export async function requirePlatformAdmin(){
  const client=await getServerSupabase();
  if(!client) return null;
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user)return null;
  const {data:admin,error:roleError}=await client.from('platform_admins').select('user_id').eq('user_id',user.id).eq('active',true).maybeSingle();
  if(roleError||!admin)return null;
  return {client,user};
}
