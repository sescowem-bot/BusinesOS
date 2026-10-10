import 'server-only';
import {getPlatformBrand, type PlatformBrand} from '@/lib/server/branding';
export type EmailMessage={recipient:string;subject:string;heading:string;body:string;buttonLabel?:string;actionUrl?:string};
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
export function renderBrandedEmail(brand:PlatformBrand,message:EmailMessage){
 const origin=process.env.NEXT_PUBLIC_APP_URL||process.env.NEXT_PUBLIC_SITE_URL||'';
 const link=message.actionUrl && ((message.actionUrl.startsWith('/')&&origin)?origin.replace(/\/$/,'')+message.actionUrl:message.actionUrl.startsWith('https://')?message.actionUrl:null);
 const logo=brand.logo_url?.startsWith('https://')?`<img alt="${esc(brand.name)}" src="${esc(brand.logo_url)}" width="120" style="max-width:120px;max-height:60px;object-fit:contain;">`:'';
 return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:32px 12px;background:#f5f7fa;font-family:Arial,sans-serif;color:#172033"><div style="max-width:580px;margin:auto;padding:32px;border:1px solid #e4e7ec;border-radius:12px;background:#fff">${logo}<h1 style="font-size:24px;color:${/^#[0-9a-f]{6}$/i.test(brand.primary_color)?brand.primary_color:'#123B63'}">${esc(message.heading)}</h1><p style="line-height:1.75;white-space:pre-line">${esc(message.body)}</p>${link?`<a href="${esc(link)}" style="display:inline-block;padding:13px 20px;background:${/^#[0-9a-f]{6}$/i.test(brand.primary_color)?brand.primary_color:'#123B63'};color:#fff;text-decoration:none;border-radius:6px">${esc(message.buttonLabel||'View details')}</a>`:''}<hr style="border:0;border-top:1px solid #e4e7ec;margin:26px 0"><p style="font-size:12px;color:#667085">${esc(brand.name)}${brand.support_email?` · ${esc(brand.support_email)}`:''}</p></div></body></html>`;
}
/** Server-only. Not wired to Auth until the Send Email Hook is verified end-to-end. */
export async function sendViaConfiguredResend(message:EmailMessage):Promise<{ok:boolean;error?:string;providerId?:string}>{
 if(process.env.ENABLE_PLATFORM_EMAIL_DELIVERY!=='true')return {ok:false,error:'Email delivery is not enabled'};
 const key=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL;
 if(!key||!from)return {ok:false,error:'Resend configuration is incomplete'};
 const brand=await getPlatformBrand();
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from:`${brand.name.replace(/[<>]/g,'')} <${from}>`,to:[message.recipient],subject:message.subject,html:renderBrandedEmail(brand,message)}),cache:'no-store'});
 if(!response.ok)return {ok:false,error:`Resend returned HTTP ${response.status}`};
 const data=await response.json() as {id?:string};return {ok:true,providerId:data.id};
}
