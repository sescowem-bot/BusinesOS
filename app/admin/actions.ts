'use server';
import {friendlyServiceError} from '@/lib/user-feedback';
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
function contrastWithWhite(value:string){
 const rgb=[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255);
 const linear=rgb.map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
 const l=.2126*linear[0]+.7152*linear[1]+.0722*linear[2];
 return 1.05/(l+.05);
}
export async function savePlatformBrand(_previous:SaveState,data:FormData):Promise<SaveState>{
 const session=await requirePlatformAdmin();
 if(!session)return {ok:false,message:'Access denied. Sign in using an authorised platform administrator account.'};
 const parsed=schema.safeParse(Object.fromEntries(Object.keys(schema.shape).map(k=>[k,data.get(k)])));
 if(!parsed.success)return {ok:false,message:parsed.error.issues[0]?.message||'Invalid settings'};
 if(contrastWithWhite(parsed.data.primary_color)<4.5)return {ok:false,message:'Choose a darker primary colour so white text remains readable. Minimum contrast: 4.5:1.'};
 if(contrastWithWhite(parsed.data.accent_color)<4.5)return {ok:false,message:'Choose a darker accent colour so labels remain readable. Minimum contrast: 4.5:1.'};
 const {error}=await session.client.from('platform_branding').update(parsed.data).eq('id',true);
 if(error)return {ok:false,message:friendlyServiceError('save these settings', error)};
 updateTag('businessos-public-brand');
 revalidatePath('/', 'layout');
 revalidatePath('/admin/branding');
 return {ok:true,message:'Brand settings saved and published.'};
}
