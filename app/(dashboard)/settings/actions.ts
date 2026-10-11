'use server';
import {friendlyServiceError} from '@/lib/user-feedback';
import {revalidatePath} from 'next/cache';
import {getWorkspace} from '@/lib/server/workspace';
async function owner(form:FormData){
 const w=await getWorkspace();
 if(w.role!=='owner'||form.get('business_id')!==w.businessId)throw new Error('Only your business owner can change these details.');
 return w;
}
export async function saveBusinessProfile(form:FormData){
 const {client,businessId}=await owner(form);
 const name=String(form.get('name')||'').trim();
 if(name.length<2||name.length>120)throw new Error('Please enter a business name between 2 and 120 characters.');
 const field=(key:string,max:number)=>String(form.get(key)||'').trim().slice(0,max);
 const {data:business,error:checkError}=await client.from('businesses').select('verified').eq('id',businessId).single();
 if(checkError)throw new Error('We could not verify your business details. Try again.');
 const email=field('email',250);
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Please enter a valid business email.');
 const publicEmail=field('directory_email',250);
 if(publicEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publicEmail))throw new Error('Please enter a valid public contact email.');
 const updates={name,directory_email:publicEmail,directory_phone:field('directory_phone',40),directory_whatsapp:field('directory_whatsapp',40),category:field('category',120),email,phone:field('phone',40),whatsapp:field('whatsapp',40),description:field('description',1000),address:field('address',300),city:field('city',120),state:field('state',120),published:business.verified&&form.get('published')==='true'};
 const {error}=await client.from('businesses').update(updates).eq('id',businessId);
 if(error)throw new Error(friendlyServiceError('save your business details',error));
 revalidatePath('/settings');revalidatePath('/dashboard');revalidatePath('/directory');
}
export async function saveBusinessLogo(form:FormData){
 const {client,businessId}=await owner(form);
 const file=form.get('logo');
 if(!(file instanceof File)||!file.size||file.size>2*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Choose a PNG, JPG or WebP image under 2 MB.');
 const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
 const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
 const jpg=bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const webp=bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!((file.type==='image/png'&&png)||(file.type==='image/jpeg'&&jpg)||(file.type==='image/webp'&&webp)))
  throw new Error('The selected image format is not supported. Please choose a PNG, JPG or WebP image.');
 const extension=({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'} as Record<string,string>)[file.type];
 const path=`${businessId}/${crypto.randomUUID()}.${extension}`;
 const {error:uploadError}=await client.storage.from('business-logos').upload(path,file,{cacheControl:'3600',contentType:file.type,upsert:false});
 if(uploadError){console.error('[business-logo] upload',uploadError.message);throw new Error('We could not upload your logo. Please try again.');}
 const {data:publicUrl}=client.storage.from('business-logos').getPublicUrl(path);
 const {error}=await client.from('businesses').update({logo_url:publicUrl.publicUrl}).eq('id',businessId);
 if(error){await client.storage.from('business-logos').remove([path]);throw new Error('We could not save your new logo. Please try again.');}
 revalidatePath('/settings');revalidatePath('/directory');revalidatePath('/dashboard');
}
