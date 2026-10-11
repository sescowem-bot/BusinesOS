'use server';
import {revalidatePath} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
export async function setVerifiedListing(form:FormData){
 const session=await requirePlatformAdmin();
 if(!session)throw new Error('Administrator access required');
 const id=String(form.get('business_id')||'');
 if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Select a valid business.');
 const {error}=await session.client.rpc('admin_verify_business_listing',{p_business:id,p_verified:form.get('verified')==='true'});
 if(error){console.error('[admin listing] failed',error.code);throw new Error('Business verification could not be updated. Please try again.');}
 revalidatePath(`/admin/businesses/${id}`);revalidatePath('/directory');
}
