 'use server';
import {friendlyServiceError} from '@/lib/user-feedback';
import {editableMarketingCards} from '@/lib/marketing-content';
import {revalidatePath,updateTag} from 'next/cache';import {z} from 'zod';import {requirePlatformAdmin} from '@/lib/server/supabase';
export type CmsState={ok:boolean;message:string};
function cmsAdminError(error:{code?:string;message?:string;status?:number},kind:'page'|'plan'){
 if(['42703','42P01','PGRST204'].includes(error.code||''))return `The ${kind} editor needs a database update that is not installed. Open System Health and verify the CMS migrations before retrying.`;
 if(error.code==='42501'||error.status===403)return 'Your System Owner session could not save this change. Sign in again and verify your administrator permissions.';
 if(error.code==='23505')return 'A record already exists with that identifier. Choose a different identifier.';
 return friendlyServiceError(`save this ${kind}`,error);
}

const slug=z.string().regex(/^[a-z][a-z0-9-]{1,70}$/);
const text=z.string().trim().max(2000);
export async function saveCmsPage(_state:CmsState,form:FormData):Promise<CmsState>{const session=await requirePlatformAdmin();if(!session)return {ok:false,message:'Access denied'};const parsed=z.object({slug,title:z.string().trim().min(3).max(160),eyebrow:text,description:text,sections:z.string().max(85000),published:z.boolean()}).safeParse({slug:form.get('slug'),title:form.get('title'),eyebrow:form.get('eyebrow'),description:form.get('description'),sections:form.get('sections'),published:form.get('published')==='on'});if(!parsed.success)return {ok:false,message:'Check page fields and content length'};let sections;try{sections=JSON.parse(parsed.data.sections);if(!Array.isArray(sections)||sections.length>55||!sections.every(s=>s&&typeof s==='object'&&typeof s.heading==='string'&&typeof s.body==='string'&&s.heading.trim().length>0&&s.heading.length<=180&&s.body.trim().length>0&&s.body.length<=2000&&(s.key===undefined||(typeof s.key==='string'&&editableMarketingCards(parsed.data.slug).some(card=>card.key===s.key))))||new Set(sections.filter(s=>s.key).map(s=>s.key)).size!==sections.filter(s=>s.key).length)throw new Error()}catch{return {ok:false,message:'Add a heading and a description to each section, or remove sections you do not need.'}};
 if(parsed.data.published&&['privacy','terms','cookies'].includes(parsed.data.slug)&&sections.some((section:{body:string})=>/Learn how this platform supports your business|has not yet published|under review|awaiting approval|publication required/i.test(section.body))){return {ok:false,message:'Replace the legal draft placeholder with a reviewed, complete policy before publishing.'}}
 const {error}=await session.client.from('public_site_pages').upsert({...parsed.data,sections,updated_by:session.user.id},{onConflict:'slug'});if(error){console.error('[cms-page] save failed',{code:error.code,slug:parsed.data.slug});return {ok:false,message:cmsAdminError(error,'page')};}updateTag('businessos-public-pages');revalidatePath('/','layout');return {ok:true,message:'Page saved'};}
export async function saveCmsPlan(_state:CmsState,form:FormData):Promise<CmsState>{const session=await requirePlatformAdmin();if(!session)return {ok:false,message:'Access denied'};const parsed=z.object({id:slug,name:z.string().min(2).max(80),price_label:z.string().max(70),billing_label:text,description:text,features:z.string().max(5000),cta_label:z.string().max(90),cta_url:z.string().regex(/^\/[a-z0-9/-]*$/),sort_order:z.coerce.number().int().min(0).max(1000),published:z.boolean()}).safeParse({id:form.get('id'),name:form.get('name'),price_label:form.get('price_label'),billing_label:form.get('billing_label'),description:form.get('description'),features:form.get('features'),cta_label:form.get('cta_label'),cta_url:form.get('cta_url'),sort_order:form.get('sort_order'),published:form.get('published')==='on'});if(!parsed.success)return {ok:false,message:'Invalid plan fields'};const parseCost=(raw:FormDataEntryValue|null)=>{const text=String(raw??'').trim();if(text==='')return null;if(!/^\d{1,12}(?:\.\d{1,2})?$/.test(text))throw new Error('Enter a valid NGN price with at most two decimals');return Number(text)};
 let monthly:number|null,yearly:number|null;
 try{monthly=parseCost(form.get('price_monthly_ngn'));yearly=parseCost(form.get('price_yearly_ngn'));}catch{return {ok:false,message:'Monthly/yearly prices must be valid positive NGN amounts or blank.'};}
 if(parsed.data.id==='free'){monthly=0;yearly=0;parsed.data.price_label='₦0';parsed.data.billing_label='Free forever';}
 const features=parsed.data.features.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,30);
 const existing=await session.client.from('public_site_plans').select('id').eq('id',parsed.data.id).maybeSingle();
 if(existing.error)return {ok:false,message:cmsAdminError(existing.error,'plan')};
 const base={...parsed.data,features,updated_by:session.user.id};
 const {error}=existing.data
  ?await session.client.from('public_site_plans').update(base).eq('id',parsed.data.id)
  :await session.client.from('public_site_plans').insert({...base,price_monthly_ngn:monthly,price_yearly_ngn:yearly});if(error){console.error('[cms-plan] save failed',{code:error.code,id:parsed.data.id});return {ok:false,message:cmsAdminError(error,'plan')};}updateTag('businessos-public-plans');revalidatePath('/','layout');revalidatePath('/admin/plans');revalidatePath('/admin/plan-access');revalidatePath('/pricing');return {ok:true,message:'Pricing plan saved. Configure its module access and staff roles under Plan Access & Roles.'};}
