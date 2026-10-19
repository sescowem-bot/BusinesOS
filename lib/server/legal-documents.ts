import 'server-only';
import {getServerSupabase} from './supabase';

export type ActiveTerms = {id:string;version_label:string;title:string;effective_at:string};
export type LegalTermsState = {document:ActiveTerms|null;available:boolean};

/** Only database-approved, effective terms can require acceptance. Missing migration
 * temporarily preserves existing signup; operational errors fail closed. */
export async function getActiveTerms():Promise<LegalTermsState>{
 const client=await getServerSupabase();
 if(!client)return {document:null,available:false};
 const {data,error}=await client.from('legal_document_versions')
  .select('id,version_label,title,effective_at')
  .eq('document_key','terms').eq('published',true)
  .lte('effective_at',new Date().toISOString())
  .order('effective_at',{ascending:false})
  .order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(error){
  if(['42P01','PGRST205'].includes(error.code||''))return {document:null,available:true};
  console.error('[legal-documents] current terms unavailable',{code:error.code});
  return {document:null,available:false};
 }
 return {document:data as ActiveTerms|null,available:true};
}
