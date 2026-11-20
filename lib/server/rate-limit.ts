import 'server-only';
import {createHmac} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
type Policy={limit:number;windowSeconds:number;scope:string};
type Input={pathname:string;ipAddress:string;userId?:string|null;kind:'api'|'action';includeIpBucket?:boolean};
export type RateLimitDecision={allowed:boolean;retryAfterSeconds:number;remaining:number;configured:boolean};
let adminClient:ReturnType<typeof createClient>|null=null;
function getAdminClient(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return null;
 if(!adminClient)adminClient=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 return adminClient;
}
function routeKey(path:string){return path.replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi,'/:id').replace(/\/[0-9]{4,}(?=\/|$)/g,'/:id').slice(0,180);}
function policyFor(pathname:string,kind:'api'|'action'):Policy{
 const path=routeKey(pathname).toLowerCase();
 if(/\/(login|signin)$/.test(path))return {limit:8,windowSeconds:900,scope:'auth-login'};
 if(/\/(signup|register)$/.test(path))return {limit:5,windowSeconds:3600,scope:'auth-signup'};
 if(/\/(forgot-password|password-reset)$/.test(path))return {limit:3,windowSeconds:900,scope:'auth-recovery'};
 if(/\/reset-password$/.test(path))return {limit:6,windowSeconds:900,scope:'auth-reset'};
 if(path==='/api/webhooks/paystack'||path==='/api/webhooks/resend')return {limit:300,windowSeconds:60,scope:'webhook:'+path};
 if(path==='/api/internal/automation-dispatch')return {limit:30,windowSeconds:60,scope:'internal-automation'};
 if(path.includes('/billing/checkout'))return {limit:8,windowSeconds:600,scope:'billing-checkout'};
 if(path.includes('/billing/verify'))return {limit:20,windowSeconds:600,scope:'billing-verify'};
 if(path.includes('/export')||path.includes('/pdf'))return {limit:5,windowSeconds:600,scope:'export:'+path};
 if(kind==='api')return {limit:120,windowSeconds:60,scope:'api:'+path};
 if(path.startsWith('/admin'))return {limit:30,windowSeconds:60,scope:'action:admin'};
 if(path.includes('/accounting')||path.includes('/payments')||path.includes('/returns'))return {limit:45,windowSeconds:60,scope:'action:financial:'+path.split('/')[1]};
 return {limit:60,windowSeconds:60,scope:'action:'+path};
}
function digest(secret:string,value:string){return createHmac('sha256',secret).update(value).digest('hex');}
async function consume(bucketKey:string,policy:Policy){
 const db=getAdminClient();if(!db)return null;
 const {data,error}=await db.rpc('businessos_consume_rate_limit',{p_bucket_key:bucketKey,p_limit:policy.limit,p_window_seconds:policy.windowSeconds});
 if(error||!Array.isArray(data)||!data[0])return null;
 const row=data[0] as {allowed?:boolean;remaining?:number;retry_after_seconds?:number};
 if(typeof row.allowed!=='boolean')return null;
 return {allowed:row.allowed,remaining:Math.max(0,Number(row.remaining)||0),retryAfterSeconds:Math.max(1,Number(row.retry_after_seconds)||1)};
}
export async function enforceRequestRateLimit(input:Input):Promise<RateLimitDecision>{
 const db=getAdminClient(),secret=process.env.RATE_LIMIT_HMAC_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!db||!secret)return {allowed:false,retryAfterSeconds:60,remaining:0,configured:false};
 const policy=policyFor(input.pathname,input.kind),identity=input.userId?'user:'+input.userId:'ip:'+(input.ipAddress||'unknown');
 const scopes=[identity+':'+policy.scope];
 if(input.userId&&input.includeIpBucket!==false)scopes.push('ip:'+(input.ipAddress||'unknown')+':'+policy.scope);
 let remaining=policy.limit,retryAfterSeconds=1;
 for(const scope of scopes){const result=await consume(digest(secret,scope),policy);if(!result)return {allowed:false,retryAfterSeconds:60,remaining:0,configured:false};remaining=Math.min(remaining,result.remaining);retryAfterSeconds=Math.max(retryAfterSeconds,result.retryAfterSeconds);if(!result.allowed)return {allowed:false,retryAfterSeconds,remaining:0,configured:true};}
 return {allowed:true,retryAfterSeconds,remaining,configured:true};
}
