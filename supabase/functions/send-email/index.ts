/**
 * Opt-in Supabase Send Email Auth Hook (deploy but DO NOT activate until staged).
 * Official payload is signed using Standard Webhooks. No user-supplied branding or URLs are trusted.
 * Deno/Supabase Edge Function. No Next.js dependency.
 */
import {Webhook} from 'npm:standardwebhooks@^1';

type AuthPayload={user:{email?:string;new_email?:string};email_data:{email_action_type:string;token?:string;token_new?:string;token_hash?:string;token_hash_new?:string;redirect_to?:string}};
type Template={subject:string;heading:string;body_text:string;button_label:string;enabled:boolean};
const secret=(key:string)=>Deno.env.get(key)||'';
const escaped=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
const origin=secret('SUPABASE_URL').replace(/\/$/,'');
const allowedOrigins=secret('ALLOWED_AUTH_REDIRECT_ORIGINS').split(',').map(s=>s.trim()).filter(Boolean);
const emailTypeKey:Record<string,string>={signup:'signup_confirmation',invite:'business_invitation',magiclink:'magic_link',recovery:'password_reset',email_change:'email_change',reauthentication:'security_code',email:'signup_confirmation'};
const defaultText:Record<string,[string,string,string,string]>={
 signup_confirmation:['Confirm your email','Confirm your email','Confirm your email address to finish setting up your account.','Confirm email'],
 business_invitation:['Your invitation','Accept your invitation','You have been invited to join a workspace.','Accept invitation'],
 magic_link:['Your sign-in link','Sign in securely','Use this secure link to sign in.','Sign in'],
 password_reset:['Reset your password','Reset your password','We received a password reset request. If this was not you, ignore this email.','Reset password'],
 email_change:['Confirm your new email','Email change request','Confirm the requested email change. Ignore this email if it was not you.','Confirm email change'],
 security_code:['Your security code','Security verification','Use the verification code shown below to continue. Never share it with anyone.','']
};
function approvedRedirect(candidate:string|undefined){
 if(!candidate)return null;
 try{const url=new URL(candidate);if(url.protocol!=='https:' || !allowedOrigins.includes(url.origin))return null;return url.toString()}catch{return null}
}
async function fetchRow<T>(table:string,params:string):Promise<T|null>{
 const response=await fetch(`${origin}/rest/v1/${table}?${params}`,{
  headers:{apikey:secret('SUPABASE_SERVICE_ROLE_KEY'),Authorization:`Bearer ${secret('SUPABASE_SERVICE_ROLE_KEY')}`},signal:AbortSignal.timeout(7000)
 });
 if(!response.ok)throw new Error('Cannot load branding or templates');
 const rows=await response.json() as T[];return rows[0]||null;
}
function render(name:string,color:string,logo:string,support:string,heading:string,body:string,button:string,link:string|null,otp:string|undefined){
 const primary=/^#[\da-fA-F]{6}$/.test(color)?color:'#123B63';
 const image=logo.startsWith('https://')?`<img src="${escaped(logo)}" alt="${escaped(name)}" width="125" style="max-width:125px;max-height:60px;object-fit:contain;">`:'';
 return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:28px 12px;background:#f5f7fa;font-family:Arial,sans-serif;color:#172033"><table role="presentation" style="width:100%;max-width:580px;margin:auto;border:1px solid #e4e7ec;border-radius:14px;background:#fff"><tr><td style="padding:32px">${image}<p style="font-size:14px;font-weight:600;color:${primary}">${escaped(name)}</p><h1 style="font-size:23px;line-height:1.25">${escaped(heading)}</h1><p style="line-height:1.75;white-space:pre-line">${escaped(body)}</p>${otp?`<p style="font-size:26px;letter-spacing:5px;font-weight:700">${escaped(otp)}</p>`:''}${link?`<p><a href="${escaped(link)}" style="display:inline-block;padding:13px 20px;border-radius:8px;background:${primary};color:#fff;text-decoration:none">${escaped(button)}</a></p>`:''}<hr style="border:0;border-top:1px solid #e4e7ec;margin:26px 0"><p style="font-size:12px;color:#667085">${escaped(name)}${support?' · '+escaped(support):''}</p></td></tr></table></body></html>`;
}
Deno.serve(async(req)=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 if(secret('ENABLE_AUTH_RESEND_EMAIL')!=='true')return new Response('Auth Resend hook disabled',{status:503});
 const hookSecret=secret('SEND_EMAIL_HOOK_SECRET').replace(/^v1,whsec_/,'');
 if(!hookSecret||!secret('RESEND_API_KEY')||!secret('RESEND_FROM_EMAIL')||!origin||!secret('SUPABASE_SERVICE_ROLE_KEY'))return new Response('Hook not configured',{status:503});
 let payload:AuthPayload;
 try{
  const raw=await req.text();
  if(raw.length>25000)return new Response('Too large',{status:413});
  payload=new Webhook(hookSecret).verify(raw,Object.fromEntries(req.headers)) as AuthPayload;
 }catch{return new Response('Invalid signature',{status:401})}
 const action=payload.email_data?.email_action_type;
 const key=emailTypeKey[action];
 if(!key)return new Response('Unsupported auth email action',{status:422});
 const email=payload.user?.email||'',newEmail=payload.user?.new_email||'';
 if(!email.includes('@')||email.length>320)return new Response('Invalid recipient',{status:422});
 try{
  const [brand,template]=await Promise.all([
   fetchRow<{name:string;logo_url:string;primary_color:string;support_email:string}>('platform_branding','select=name,logo_url,primary_color,support_email&id=eq.true'),
   fetchRow<Template>('platform_email_templates',`select=subject,heading,body_text,button_label,enabled&template_key=eq.${encodeURIComponent(key)}`)
  ]);
  const name=brand?.name||'BusinessOS',logo=brand?.logo_url||'',support=brand?.support_email||'',color=brand?.primary_color||'#123B63';
  const copy=template?.enabled!==false&&template?[template.subject,template.heading,template.body_text,template.button_label]:defaultText[key];
  const [subject,heading,body,button]=copy;
  const replaceName=(s:string)=>s.replaceAll('{{platform_name}}',name).replaceAll('{{support_email}}',support||'support');
  const redirect=approvedRedirect(payload.email_data.redirect_to);
  const verify=(hash:string|undefined,type:string)=>{
   if(!hash)return null;
   const uri=new URL(`${origin}/auth/v1/verify`);
   uri.searchParams.set('token',hash);uri.searchParams.set('type',type);
   if(redirect)uri.searchParams.set('redirect_to',redirect);
   return uri.toString();
  };
  const d=payload.email_data;
  const attempts:{to:string;hash?:string;code?:string;type:string}[]=[];
  if(action==='email_change'){
   if(!newEmail.includes('@'))return new Response('Missing new email',{status:422});
   if(d.token_hash_new && d.token_hash){
    // Supabase's secure email change hash names are reversed (per official hook docs).
    attempts.push({to:email,hash:d.token_hash_new,code:d.token,type:'email_change'});
    attempts.push({to:newEmail,hash:d.token_hash,code:d.token_new,type:'email_change'});
   }else attempts.push({to:newEmail,hash:d.token_hash,code:d.token_new||d.token,type:'email_change'});
  }else attempts.push({to:email,hash:d.token_hash,code:d.token,type:action==='email'?'email':action});
  for(let i=0;i<attempts.length;i++){
   const a=attempts[i];const link=verify(a.hash,a.type);
   const html=render(name,color,logo,support,replaceName(heading),replaceName(body),replaceName(button),link,action==='reauthentication'?a.code:undefined);
   const id=req.headers.get('webhook-id')||req.headers.get('svix-id')||crypto.randomUUID();
   const response=await fetch('https://api.resend.com/emails',{
    method:'POST',headers:{Authorization:`Bearer ${secret('RESEND_API_KEY')}`,'Content-Type':'application/json','Idempotency-Key':`${id}-${i}`},
    body:JSON.stringify({from:`${name.replace(/[<>]/g,'').slice(0,100)} <${secret('RESEND_FROM_EMAIL')}>`,to:[a.to],subject:replaceName(subject),html}),signal:AbortSignal.timeout(12000)
   });
   if(!response.ok)return new Response('Resend sending failed',{status:502});
  }
  return new Response(null,{status:200});
 }catch{return new Response('Auth email unavailable',{status:503})}
});
