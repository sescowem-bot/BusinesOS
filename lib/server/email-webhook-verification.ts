/** Standard Webhooks signature validation for Resend's svix headers. */
import {createHmac,timingSafeEqual} from 'node:crypto';
export function verifyResendSignature(body:string, headers:Headers, signingSecret:string, nowSeconds=Math.floor(Date.now()/1000)){
 const id=headers.get('svix-id'), timestamp=headers.get('svix-timestamp'), signature=headers.get('svix-signature');
 if(!id||!timestamp||!signature||!/^[-_a-zA-Z0-9]{1,150}$/.test(id)||!/^\d{10}$/.test(timestamp))return false;
 const seconds=Number(timestamp);
 if(!Number.isSafeInteger(seconds)||Math.abs(nowSeconds-seconds)>300)return false;
 if(!/^whsec_[A-Za-z0-9_+\/-]+={0,2}$/.test(signingSecret))return false;
 let key:Buffer;
 try{key=Buffer.from(signingSecret.slice(6).replace(/-/g,'+').replace(/_/g,'/'),'base64')}catch{return false}
 if(key.length<16)return false;
 const expected=createHmac('sha256',key).update(`${id}.${timestamp}.${body}`).digest();
 for(const part of signature.split(/\s+/)){
  if(!part.startsWith('v1,'))continue;
  const supplied=Buffer.from(part.slice(3),'base64');
  if(supplied.length===expected.length && timingSafeEqual(supplied,expected))return true;
 }
 return false;
}
