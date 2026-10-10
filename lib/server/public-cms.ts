import 'server-only';
import {createClient} from '@supabase/supabase-js';
export type PublicPage={slug:string;title:string;eyebrow:string;description:string;sections:{heading:string;body:string}[];published:boolean};
export type PublicPlan={id:string;name:string;price_label:string;billing_label:string;description:string;features:string[];cta_label:string;cta_url:string;sort_order:number;published:boolean};
const defaults:Record<string,PublicPage>={
 home:{slug:'home',title:'The clearer way to run your business.',eyebrow:'YOUR BUSINESS, BETTER CONNECTED',description:'Bring customers, orders, payments and business records into one organised workspace. Less chasing information. More room to focus on what matters.',sections:[],published:true},
 features:{slug:'features',title:'Everyday operations, finally connected.',eyebrow:'WHAT YOU CAN DO',description:'From your first customer record to the end-of-day numbers, BusinessOS brings your essential work together without unnecessary complexity.',sections:[
 {heading:'Customers and relationships',body:'Keep customer details, order histories and amounts owed close at hand. Give your team one reliable place to find the next action.'},
 {heading:'Orders and collections',body:'Record what was sold, capture full or partial payments, and keep track of outstanding balances without piecing together separate spreadsheets.'},
 {heading:'Products and stock',body:'Maintain your product catalogue, monitor available stock and review movements as your operations grow.'},
 {heading:'Invoices and business records',body:'Prepare order-linked commercial invoices and printable payment acknowledgements, with a clearer history of each transaction.'},
 {heading:'Accounting and reporting',body:'Organise expenses, journals and financial reports in a dedicated workspace. Accounting automation is being expanded and should be reviewed before formal reporting.'},
 {heading:'Tax and compliance records',body:'Keep tax-relevant information organised for professional review. BusinessOS does not currently submit tax returns or replace qualified tax advice.'}],published:true},
 solutions:{slug:'solutions',title:'Built around your day, not another complicated process.',eyebrow:'SOLUTIONS FOR HOW YOU WORK',description:'Every business has its own rhythm. BusinessOS gives retailers, service teams and growing companies a simpler way to stay on top of the work that keeps them moving.',sections:[
 {heading:'Retail and trading',body:'Bring products, stock, sales and customer balances into one daily workflow. See what has been sold and what still needs to be collected.'},
 {heading:'Service businesses',body:'Keep client details, service orders, quotations and payments connected from enquiry to completion.'},
 {heading:'Creative and independent brands',body:'Keep made-to-order requests, deposits and customer communication organised so important details do not get lost.'},
 {heading:'Growing teams',body:'Give authorised team members access to the business records they need, while business owners maintain oversight of operations.'}],published:true},
 'how-it-works':{slug:'how-it-works',title:'Set up once. Stay organised every day.',eyebrow:'A SIMPLER WORKFLOW',description:'Start with the essentials, build a consistent daily routine and add more capabilities as your business grows.',sections:[
 {heading:'01 · Create your workspace',body:'Register your account and add your business information to create a dedicated place for your records.'},
 {heading:'02 · Bring in the essentials',body:'Add customers, products or services, and begin recording the work your business actually does.'},
 {heading:'03 · Record each transaction',body:'Keep orders, payments and expenses organised as they happen, including partial payments and outstanding balances.'},
 {heading:'04 · Review and improve',body:'Use available summaries and reports to review activity, identify outstanding work and make more informed decisions.'}],published:true},
 about:{slug:'about',title:'Making the business side of business feel simpler.',eyebrow:'WHY WE ARE BUILDING',description:'BusinessOS is designed around a practical belief: growing a business should not mean losing track of the details that matter.',sections:[
 {heading:'Clarity before complexity',body:'We focus on straightforward workflows that help teams record what happened, understand what is outstanding and know what to do next.'},
 {heading:'Built for everyday work',body:'Customers, orders, payments and records belong together. Our goal is to make those connections natural, whether you work on a laptop or a phone.'},
 {heading:'Designed to grow with you',body:'Start with the core tools. Add team members and advanced capabilities when your business is ready.'}],published:true},
 resources:{slug:'resources',title:'Better habits build stronger businesses.',eyebrow:'PRACTICAL GUIDES',description:'Useful starting points for organising your records, managing customer balances and understanding the numbers behind your work.',sections:[
 {heading:'Keep customer balances clear',body:'Record the amount charged, every payment received and any amount still outstanding. Review unresolved balances regularly.'},
 {heading:'Know the difference between sales and cash',body:'An order can be recorded before the money is fully collected. Track both so your business decisions reflect reality.'},
 {heading:'Keep expenses close to the transaction',body:'Record everyday business spending promptly, with dates, descriptions and supporting documents whenever possible.'},
 {heading:'Plan for tax review',body:'Maintain consistent financial records and confirm current obligations with official guidance and a qualified adviser before filing.'}],published:true},
 contact:{slug:'contact',title:'Questions? We are here to help.',eyebrow:'GET IN TOUCH',description:'Whether you are exploring the platform or need help with an existing workspace, reach the BusinessOS team through the official contact details below.',sections:[
 {heading:'Business enquiries',body:'Ask about getting started, the available business plans or what a particular feature supports.'},
 {heading:'Account assistance',body:'For sign-in, workspace or account questions, contact the support team using the email configured by the platform owner.'}],published:true},
 privacy:{slug:'privacy',title:'Privacy notice',eyebrow:'LEGAL INFORMATION',description:'Information about how personal data is handled on this platform.',sections:[
 {heading:'Policy under review',body:'The platform operator has not yet published an approved privacy notice. Before relying on this service for personal data, request the completed notice from the support team.'},
 {heading:'What the final notice should explain',body:'The types of information collected, why it is used, any service providers involved, retention practices, security measures, user rights and how to contact the responsible organisation.'}],published:false},
 terms:{slug:'terms',title:'Terms of service',eyebrow:'LEGAL INFORMATION',description:'Important information about the terms governing use of this platform.',sections:[
 {heading:'Terms under review',body:'The platform operator has not yet published approved terms of service. Request the current terms from the support team before using the platform for commercial operations.'},
 {heading:'What the final terms should cover',body:'Account responsibilities, permitted use, plan access, service availability, data ownership, support, suspension, dispute handling and applicable legal terms.'}],published:false},
 cookies:{slug:'cookies',title:'Cookie notice',eyebrow:'LEGAL INFORMATION',description:'Information about cookies and similar storage technologies.',sections:[
 {heading:'Cookie notice under review',body:'The platform operator has not yet published a verified cookie notice. A complete notice should describe any essential session storage and any optional analytics or marketing technologies actually in use.'},
 {heading:'Your choices',body:'Browser settings may let you clear or block stored cookies. Some account and security features may require essential cookies. Contact the support team for the current technology list.'}],published:false}
};
const legalSlugs=new Set(['privacy','terms','cookies']);
const legacyBoilerplate='Learn how this platform supports your business. Our team can customise this content from the CMS.';
const legacyTitles:Record<string,string>={features:'Everything you need to run your business.',solutions:'A workspace for the way you do business.','how-it-works':'Get organised in a few clear steps.',about:'Built to make running a business clearer.',resources:'Practical guidance for growing businesses.',contact:'We would love to hear from you.'};
const legacyDescriptions:Record<string,string>={features:'Bring your records and operations together.',solutions:'Tools for products, services and mixed businesses.','how-it-works':'A straightforward start for your business.',about:'Practical software for growing businesses.',resources:'Learn business records, pricing and compliance.',contact:'Contact the platform team.'};
const legacyEyebrows:Record<string,string>={features:'THE PLATFORM',solutions:'SOLUTIONS','how-it-works':'HOW IT WORKS',about:'ABOUT',resources:'RESOURCES',contact:'CONTACT'};
const demoPlans:PublicPlan[]=[{id:'starter',name:'Starter',price_label:'Contact us',billing_label:'Pilot access',description:'For sole traders and small businesses starting to organise daily records.',features:['Customers and orders','Manual payment tracking','Basic stock and business records'],cta_label:'Request access',cta_url:'/contact',sort_order:1,published:true},{id:'growth',name:'Growth',price_label:'Contact sales',billing_label:'Pricing to be announced',description:'For growing businesses that need deeper visibility and team workflows.',features:['Advanced reporting foundations','Team management','Accounting and tax records'],cta_label:'Talk to sales',cta_url:'/contact',sort_order:2,published:true}];
function publicClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;return url&&key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}):null}
export async function getPublicPage(slug:string):Promise<(PublicPage & {reviewRequired?:boolean})|null>{
 const fallback=defaults[slug]||null;
 const legal=legalSlugs.has(slug);
 const draft=legal&&fallback?{...fallback,reviewRequired:true}:null;
 const client=publicClient();
 if(!client)return draft||(fallback?.published?fallback:null);
 try{
  const {data,error}=await client.from('public_site_pages').select('slug,title,eyebrow,description,sections,published').eq('slug',slug).eq('published',true).maybeSingle();
  if(error)return draft||(fallback?.published?fallback:null);
  if(!data)return draft||(fallback?.published?fallback:null);
  // A legacy legal placeholder is never treated as an approved published policy.
  if(legal&&Array.isArray(data.sections)&&data.sections.some((section:{body?:string})=>section?.body===legacyBoilerplate))return draft;
  // Display improved editorial defaults only for the exact migration-016 boilerplate. Keep custom CMS edits.
  if(fallback&&!legal&&Array.isArray(data.sections)&&data.sections.length===1&&data.sections[0]?.body===legacyBoilerplate){
   return {...fallback,title:data.title===legacyTitles[slug]?fallback.title:data.title,description:data.description===legacyDescriptions[slug]?fallback.description:data.description,eyebrow:data.eyebrow===legacyEyebrows[slug]?fallback.eyebrow:data.eyebrow};
  }
  if(slug==='home'&&fallback&&data.title==='Run your business with clarity. Grow with confidence.'&&Array.isArray(data.sections)&&data.sections.length===1&&data.sections[0]?.heading==='Everything you need to keep business moving.'&&data.sections[0]?.body==='No more switching between notebooks, scattered messages and separate spreadsheets.'&&data.description==='From customers and orders to accounting, stock and financial insights, bring the important parts of your business together in one thoughtful workspace.'&&data.eyebrow==='One workspace for your entire business'){
   return {...fallback};
  }
  return {...data,sections:Array.isArray(data.sections)?data.sections.filter((section:unknown)=>Boolean(section&&typeof section==='object'&&'heading' in section&&'body' in section&&typeof section.heading==='string'&&typeof section.body==='string')):[],reviewRequired:false} as PublicPage & {reviewRequired?:boolean};
 }catch{return draft||(fallback?.published?fallback:null)}
}
export async function getPublishedPlans():Promise<PublicPlan[]>{
 const client=publicClient();if(!client)return [];
 try{
  const {data,error}=await client.from('public_site_plans').select('id,name,price_label,billing_label,description,features,cta_label,cta_url,sort_order,published').eq('published',true).order('sort_order');
  if(error)return [];
  return (data||[]).map(p=>({...p,features:Array.isArray(p.features)?p.features.filter((f:unknown):f is string=>typeof f==='string'):[]})) as PublicPlan[];
 }catch{return []}
}
/** Published feature lookup is intentionally limited to published plans and enabled modules. */
export async function getPublishedPlanCapabilities():Promise<{byPlan:Record<string,string[]>;available:boolean}>{
 const client=publicClient();
 if(!client)return {byPlan:{},available:false};
 try{
  const {data,error}=await client.rpc('published_plan_features');
  if(error)return {byPlan:{},available:false};
  const byPlan:Record<string,string[]>={};
  for(const row of data||[]){if(typeof row.plan_id==='string'&&typeof row.feature_key==='string'){
   (byPlan[row.plan_id]??=[]).push(row.feature_key);
  }}
  return {byPlan,available:true};
 }catch{return {byPlan:{},available:false}}
}
export const defaultPages=Object.values(defaults);
export const defaultPlans=demoPlans;
