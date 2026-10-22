import {randomUUID} from 'node:crypto';

type SafeContext={routePath?:string;routerKind?:string};
const safeName=(value:unknown)=>{
 if(!(value instanceof Error))return 'UnknownError';
 return /^[A-Za-z][A-Za-z0-9_]{0,48}$/.test(value.name)?value.name:'Error';
};
// Never copy error.message, request URLs, cookies, headers, bodies, query strings,
// user IDs or raw stack traces into monitoring events.
export function makeRedactedErrorEvent(error:unknown,context:SafeContext={}){
 const template=typeof context.routePath==='string'&&
  /^\/[a-zA-Z0-9_\/\[\]().-]{0,180}$/.test(context.routePath)
   ?context.routePath:'/unknown';
 return {
  event_id:randomUUID().replace(/-/g,''),
  timestamp:new Date().toISOString(),
  platform:'javascript',
  level:'error',
  environment:process.env.VERCEL_ENV||process.env.NODE_ENV||'unknown',
  logger:'businessos.server',
  exception:{values:[{type:safeName(error),value:'Server request failed. Details redacted.'}]},
  tags:{route_template:template,router:context.routerKind==='app'?'app':'unknown'},
 };
}
function sentryTarget(raw:string){
 try{
  const dsn=new URL(raw);
  const host=dsn.hostname.toLowerCase();
  // A strict host allowlist prevents an env typo sending event data to an unknown host.
  if(dsn.protocol!=='https:'||!(
    host==='sentry.io'||host.endsWith('.ingest.sentry.io')
   )||!dsn.username||!/^\d+$/.test(dsn.pathname.replace(/^\//,'')))return null;
  return {dsn:dsn.toString(),url:`https://${host}/api/${dsn.pathname.slice(1)}/envelope/`};
 }catch{return null;}
}
export async function reportRedactedServerError(error:unknown,context:SafeContext={}){
 const event=makeRedactedErrorEvent(error,context);
 // Vercel runtime logs provide a fallback without requiring an external service.
 console.error('[businessos.server.error]',event.exception.values[0].type,event.tags.route_template,event.event_id);
 const target=sentryTarget(process.env.BUSINESSOS_SENTRY_DSN||'');
 if(!target)return;
 const envelope=[
  JSON.stringify({event_id:event.event_id,dsn:target.dsn}),
  JSON.stringify({type:'event'}),
  JSON.stringify(event)
 ].join('\n');
 try{
  await fetch(target.url,{
   method:'POST',headers:{'Content-Type':'application/x-sentry-envelope'},
   body:envelope,signal:AbortSignal.timeout(2000)
  });
 }catch{
  // Monitoring must never crash customer workflows or retry with sensitive details.
  console.error('[businessos.monitoring] Error event delivery unavailable');
 }
}
