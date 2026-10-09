import 'server-only';
import {createClient} from '@supabase/supabase-js';
export type PlatformBrand={name:string;short_name:string;tagline:string;description:string;support_email:string;support_phone:string;logo_url:string;favicon_url:string;primary_color:string;accent_color:string};
export const defaultBrand:PlatformBrand={name:'BusinessOS',short_name:'BusinessOS',tagline:'Run your business. Stay in control.',description:'A modern operating platform for small and growing businesses.',support_email:'',support_phone:'',logo_url:'',favicon_url:'',primary_color:'#123B63',accent_color:'#16845B'};
export async function getPlatformBrand():Promise<PlatformBrand>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return defaultBrand;
 try{
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await supabase.from('platform_branding').select('name,short_name,tagline,description,support_email,support_phone,logo_url,favicon_url,primary_color,accent_color').eq('id',true).maybeSingle();
  if(error||!data)return defaultBrand;
  return {...defaultBrand,...data};
 }catch{return defaultBrand}
}
