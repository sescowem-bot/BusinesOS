'use server';
import {createHash} from 'node:crypto';
import {revalidatePath,updateTag} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {getPublicPage} from '@/lib/server/public-cms';

export type LegalApprovalState={ok:boolean;message:string};
export async function registerReviewedPolicy(_:LegalApprovalState,form:FormData):Promise<LegalApprovalState>{
 const a=await requirePlatformAdmin();
 if(!a)return {ok:false,message:'Active System Owner session required.'};
 const key=String(form.get('document_key')||'');
 const version=String(form.get('version')||'').trim();
 const reviewer=String(form.get('review_reference')||'').trim();
 if(!['terms','privacy','cookies'].includes(key)||!/^[-A-Za-z0-9.]{1,60}$/.test(version)||reviewer.length<8||reviewer.length>500||form.get('review_confirm')!=='on')
  return {ok:false,message:'Select a policy, enter a version and actual legal review reference, and confirm approval.'};
 const page=await getPublicPage(key);
 if(!page||page.reviewRequired||!page.published||!Array.isArray(page.sections)||page.sections.length<2)
  return {ok:false,message:'This policy is not published with reviewed content in the website CMS. Finish legal review and publish the approved content first.'};
 if(page.sections.some(s=>/has not yet published|awaiting approval|under review|learn how this platform supports|requires verified policy/i.test(s.body)))
  return {ok:false,message:'The document still contains draft language. Have the final content independently reviewed.'};
 const canonical=JSON.stringify({slug:page.slug,title:page.title,eyebrow:page.eyebrow,description:page.description,sections:page.sections});
 const checksum=createHash('sha256').update(canonical,'utf8').digest('hex');
 const {error}=await a.client.rpc('register_reviewed_legal_document',{
  p_key:key,p_version:version,p_hash:checksum,p_reviewer_reference:reviewer
 });
 if(error){
  console.error('[reviewed-policy] registration failed',{code:error.code,policy:key});
  return {ok:false,message:error.code==='23505'?'That policy version already exists. Use a new approved version number.':'Policy registration failed. Verify SQL 051 and SQL 052 are installed and that approval conditions are met.'};
 }
 updateTag('businessos-public-pages');
 revalidatePath('/admin/privacy/legal');revalidatePath('/admin/privacy');revalidatePath('/signup');revalidatePath('/onboarding');
 return {ok:true,message:'Reviewed policy version registered with an approval record and content checksum. Confirm the live page before onboarding customers.'};
}
