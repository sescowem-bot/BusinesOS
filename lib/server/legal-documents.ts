import 'server-only';
import {getServerSupabase} from './supabase';
import {getPublicPage} from './public-cms';
import {createHash} from 'node:crypto';

export type ActiveTerms = {id:string;version_label:string;title:string;effective_at:string};
export type LegalTermsState = {document:ActiveTerms|null;available:boolean};

/** Only database-approved, effective terms can require acceptance. Missing migration
 * temporarily preserves existing signup; operational errors fail closed. */
export async function getActiveTerms():Promise<LegalTermsState>{
 const client=await getServerSupabase();
 if(!client)return {document:null,available:false};
 const {data,error}=await client.from('legal_document_versions')
  .select('id,version_label,title,effective_at,content_sha256')
  .eq('document_key','terms').eq('published',true)
  .lte('effective_at',new Date().toISOString())
  .order('effective_at',{ascending:false})
  .order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(error){
  if(['42P01','PGRST205'].includes(error.code||''))return {document:null,available:true};
  console.error('[legal-documents] current terms unavailable',{code:error.code});
  return {document:null,available:false};
 }
 if(data){
  const page=await getPublicPage('terms');
  if(!page||page.reviewRequired){
   console.error('[legal-documents] approved Terms missing from public CMS');
   return {document:null,available:false};
  }
  const canonical=JSON.stringify({slug:page.slug,title:page.title,eyebrow:page.eyebrow,description:page.description,sections:page.sections});
  const checksum=createHash('sha256').update(canonical,'utf8').digest('hex');
  if(checksum!==data.content_sha256){
   console.error('[legal-documents] approved Terms content no longer matches live CMS');
   return {document:null,available:false};
  }
 }
 return {document:data as ActiveTerms|null,available:true};
}
