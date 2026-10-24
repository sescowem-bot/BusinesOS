import {createHmac,timingSafeEqual} from 'node:crypto';
export const MAX_PAYSTACK_WEBHOOK_BYTES=100000;
/** Reject bytes before allocating a full potentially unbounded body. */
export async function limitedWebhookBody(body:ReadableStream<Uint8Array>|null,maxBytes=MAX_PAYSTACK_WEBHOOK_BYTES):Promise<Uint8Array|null>{
 if(!body)return null;
 const reader=body.getReader();const parts:Uint8Array[]=[];let total=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   total+=value.byteLength;
   if(total>maxBytes){await reader.cancel();return null}
   parts.push(value);
  }
 }finally{reader.releaseLock()}
 const out=new Uint8Array(total);let offset=0;
 for(const part of parts){out.set(part,offset);offset+=part.byteLength}
 return out;
}
export function signedPaystackPayload(raw:Uint8Array,signature:string|null,secret:string):boolean{
 if(!/^[a-f0-9]{128}$/i.test(signature||'')||!secret)return false;
 const expected=createHmac('sha512',secret).update(raw).digest();
 const received=Buffer.from(signature!,'hex');
 return received.length===expected.length&&timingSafeEqual(expected,received);
}
