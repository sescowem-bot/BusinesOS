'use server';
import {revalidatePath,updateTag} from 'next/cache';
import {z} from 'zod';
import {requirePlatformAdmin} from '@/lib/server/supabase';

const hex=z.string().regex(/^#[0-9a-fA-F]{6}$/,'Enter a six-digit colour such as #123B63');
const schema=z.object({
 name:z.string().trim().min(2).max(90),short_name:z.string().trim().min(2).max(28),
 tagline:z.string().trim().max(150),description:z.string().trim().max(400),
 support_email:z.union([z.literal(''),z.email().max(200)]),support_phone:z.string().trim().max(35),
 primary_color:hex,accent_color:hex
});
export type SaveState={ok:boolean;message:string};
export async function savePlatformBrand(_previous:SaveState,data:FormData):Promise<SaveState>{
 const session=await requirePlatformAdmin();
 if(!session)return {ok:false,message:'Access denied. Sign in using an authorised platform administrator account.'};
 const parsed=schema.safeParse(Object.fromEntries(Object.keys(schema.shape).map(k=>[k,data.get(k)])));
 if(!parsed.success)return {ok:false,message:parsed.error.issues[0]?.message||'Invalid settings'};
 const {error}=await session.client.from('platform_branding').update(parsed.data).eq('id',true);
 if(error)return {ok:false,message:'Could not save settings: '+error.message};
 updateTag('businessos-public-brand');
 revalidatePath('/', 'layout');
 return {ok:true,message:'Platform identity saved and published.'};
}
