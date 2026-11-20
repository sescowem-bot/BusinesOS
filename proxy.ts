import {createServerClient} from '@supabase/ssr';
import {NextRequest,NextResponse} from 'next/server';
import {authCookieOptions,DEVICE_SESSION_COOKIE} from '@/lib/auth-session-preference';
import {enforceRequestRateLimit} from '@/lib/server/rate-limit';
const protectedPath=/^\/(admin|onboarding|dashboard|orders|customers|products|inventory|purchasing|pos|returns|payments|invoices|settings|tax-profile|tax-centre|tax-compliance|reports|insights|team|tasks|accounting|expenses|growth|communications|campaigns|automations|marketplace|partners|quotes|notifications|upgrade)(\/|$)/;
function clientIp(request:NextRequest){
 const real=request.headers.get('x-real-ip')?.trim();
 if(real&&real.length<=64)return real;
 const forwarded=request.headers.get('x-forwarded-for')||'';
 const last=forwarded.split(',').map(value=>value.trim()).filter(Boolean).at(-1);
 return last&&last.length<=64?last:'unknown';
}
function unavailable(retryAfter='60'){return NextResponse.json({error:'Security service temporarily unavailable. Please try again.'},{status:503,headers:{'Retry-After':retryAfter,'Cache-Control':'no-store'}});}
function limited(retryAfter:string){return NextResponse.json({error:'Too many requests. Please wait before trying again.'},{status:429,headers:{'Retry-After':retryAfter,'Cache-Control':'no-store'}});}
export async function proxy(request:NextRequest){
 const pathname=request.nextUrl.pathname,isApi=pathname.startsWith('/api/'),isRouteHandler=isApi||pathname==='/auth/callback';
 const isServerAction=request.method==='POST'&&request.headers.has('next-action'),shouldRefresh=protectedPath.test(pathname);
 if(!isRouteHandler&&!isServerAction&&!shouldRefresh)return NextResponse.next({request});
 const ipAddress=clientIp(request),kind=isRouteHandler?'api':'action';
 if(isRouteHandler||isServerAction){
  try{const d=await enforceRequestRateLimit({pathname,ipAddress,userId:null,kind});if(!d.configured)return unavailable(String(d.retryAfterSeconds));if(!d.allowed)return limited(String(d.retryAfterSeconds));}
  catch{return unavailable();}
 }
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 let response=NextResponse.next({request}),userId:string|null=null;
 if(url&&key){
  const remembered=request.cookies.get(DEVICE_SESSION_COOKIE)?.value==='remember';
  const supabase=createServerClient(url,key,{cookies:{
   getAll(){return request.cookies.getAll();},
   setAll(items){for(const item of items)request.cookies.set(item.name,item.value);response=NextResponse.next({request});for(const item of items)response.cookies.set(item.name,item.value,authCookieOptions(item.options,remembered));}
  }});
  try{const {data}=await supabase.auth.getUser();userId=data.user?.id||null;}catch{/* Authorization remains independent. */}
 }
 if((isRouteHandler||isServerAction)&&userId){
  try{const d=await enforceRequestRateLimit({pathname,ipAddress,userId,kind,includeIpBucket:false});if(!d.configured)return unavailable(String(d.retryAfterSeconds));if(!d.allowed)return limited(String(d.retryAfterSeconds));}
  catch{return unavailable();}
 }
 return response;
}
export const config={matcher:['/:path*']};
