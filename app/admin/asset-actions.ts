'use server';

import {randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';

export type AssetUploadState={ok:boolean;message:string};
const BUCKET='platform-brand-assets';

function detectImage(bytes:Uint8Array):{mime:string;extension:string}|null{
 if(bytes.length>=8 && [137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))return {mime:'image/png',extension:'png'};
 if(bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255)return {mime:'image/jpeg',extension:'jpg'};
 if(bytes.length>=12 && String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP')return {mime:'image/webp',extension:'webp'};
 if(bytes.length>=6 && bytes[0]===0 && bytes[1]===0 && bytes[2]===1 && bytes[3]===0 && bytes[4]>0 && bytes[5]===0)return {mime:'image/x-icon',extension:'ico'};
 return null;
}

export async function uploadBrandAsset(_:AssetUploadState,data:FormData):Promise<AssetUploadState>{
 const session=await requirePlatformAdmin();
 if(!session)return {ok:false,message:'An active System Owner session is required.'};
 const kind=data.get('asset_type');
 if(kind!=='logo'&&kind!=='favicon')return {ok:false,message:'Select a valid brand asset type.'};
 const file=data.get('asset');
 if(!(file instanceof File) || !file.size)return {ok:false,message:'Choose an image to upload.'};
 const max=kind==='favicon'?524288:1572864;
 if(file.size>max)return {ok:false,message:kind==='favicon'?'Favicon must be 512 KB or smaller.':'Logo must be 1.5 MB or smaller.'};
 const bytes=new Uint8Array(await file.arrayBuffer());
 const format=detectImage(bytes);
 if(!format || (kind==='favicon' && !['image/png','image/x-icon','image/webp'].includes(format.mime)))
  return {ok:false,message:'Upload a PNG, JPEG or WebP logo, or PNG, WebP or ICO favicon. SVG files are not supported.'};
 const path=`${kind}/${randomUUID()}.${format.extension}`;
 const {error:uploadError}=await session.client.storage.from(BUCKET).upload(path,bytes,{
  contentType:format.mime,cacheControl:'3600',upsert:false
 });
 if(uploadError)return {ok:false,message:'Upload failed. Check migration 026 and Storage access: '+uploadError.message};
 const {data:publicAsset}=session.client.storage.from(BUCKET).getPublicUrl(path);
 const url=publicAsset.publicUrl;
 if(!url.startsWith('https://')){
  await session.client.storage.from(BUCKET).remove([path]);
  return {ok:false,message:'A secure public asset URL could not be generated.'};
 }
 const {error:saveError}=await session.client.from('platform_branding')
  .update(kind==='logo'?{logo_url:url}:{favicon_url:url}).eq('id',true);
 if(saveError){
  await session.client.storage.from(BUCKET).remove([path]);
  return {ok:false,message:'Asset uploaded but branding could not be updated: '+saveError.message};
 }
 revalidatePath('/','layout');
 revalidatePath('/admin/website');
 revalidatePath('/admin/email');
 return {ok:true,message:`${kind==='logo'?'Logo':'Favicon'} uploaded and published. Refresh the website to see the change.`};
}
