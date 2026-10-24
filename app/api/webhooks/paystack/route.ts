import {NextRequest,NextResponse} from 'next/server';
import {billingReady,verifyPaystackPayment,activateVerifiedPayment} from '@/lib/server/billing';
import {limitedWebhookBody,signedPaystackPayload} from '@/lib/phase3/paystack-webhook-policy';
export const runtime='nodejs';
export async function POST(request:NextRequest){
 if(!billingReady())return NextResponse.json({ok:false},{status:503});
 const raw=await limitedWebhookBody(request.body);
 if(!raw)return NextResponse.json({ok:false},{status:413});
 if(!signedPaystackPayload(raw,request.headers.get('x-paystack-signature'),process.env.PAYSTACK_SECRET_KEY||''))
  return NextResponse.json({ok:false},{status:401});
 let event:unknown;
 try{event=JSON.parse(new TextDecoder().decode(raw))}catch{return NextResponse.json({ok:false},{status:400})}
 if(!event||typeof event!=='object')return NextResponse.json({ok:false},{status:400});
 const v=event as {event?:unknown;data?:{reference?:unknown}};
 if(v.event!=='charge.success')return NextResponse.json({ok:true});
 const ref=v.data?.reference;
 if(typeof ref!=='string'||!ref.startsWith('bos_'))return NextResponse.json({ok:true});
 // Signature alone does not activate access. Always re-verify this charge
 // through Paystack and the atomic, idempotent database activation RPC.
 const verified=await verifyPaystackPayment(ref);
 if(!verified)return NextResponse.json({ok:false},{status:503});
 const activated=await activateVerifiedPayment(verified);
 return NextResponse.json({ok:activated},{status:activated?200:503});
}
