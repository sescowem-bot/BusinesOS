import {NextRequest,NextResponse} from 'next/server';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {billingReady,verifyPaystackPayment,activateVerifiedPayment} from '@/lib/server/billing';
export const runtime='nodejs';
export async function POST(request:NextRequest){
 if(!billingReady())return NextResponse.json({ok:false},{status:503});
 const raw=await request.text();
 if(raw.length>100_000)return NextResponse.json({ok:false},{status:413});
 const signature=request.headers.get('x-paystack-signature')||'';
 const expected=createHmac('sha512',process.env.PAYSTACK_SECRET_KEY!).update(raw).digest('hex');
 if(!/^[a-f0-9]{128}$/i.test(signature)||!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(signature,'hex')))
  return NextResponse.json({ok:false},{status:401});
 try{
  const event=JSON.parse(raw) as {event?:string;data?:{reference?:string}};
  if(event.event==='charge.success'&&typeof event.data?.reference==='string'&&event.data.reference.startsWith('bos_')){
   const verified=await verifyPaystackPayment(event.data.reference);
   if(!verified||!await activateVerifiedPayment(verified))return NextResponse.json({ok:false},{status:503});
  }
  return NextResponse.json({ok:true});
 }catch{return NextResponse.json({ok:false},{status:400});}
}
