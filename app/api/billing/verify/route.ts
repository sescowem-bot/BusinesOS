import {NextRequest,NextResponse} from 'next/server';
import {getWorkspace} from '@/lib/server/workspace';
import {billingAdmin,verifyPaystackPayment,activateVerifiedPayment,billingReady} from '@/lib/server/billing';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 const origin=new URL(request.url).origin;
 const status=(code:string)=>NextResponse.redirect(new URL(`/upgrade?checkout=${code}`,origin),303);
 if(!billingReady())return status('unavailable');
 const reference=request.nextUrl.searchParams.get('reference')||'';
 if(!/^[a-zA-Z0-9_-]{14,90}$/.test(reference))return status('invalid');
 try{
  const {businessId,role}=await getWorkspace();
  if(role!=='owner')return status('owner');
  const {data:row}=await billingAdmin().from('business_subscription_payments').select('business_id,status').eq('reference',reference).maybeSingle();
  if(!row||row.business_id!==businessId)return status('invalid');
  if(row.status==='paid')return status('success');
  const verified=await verifyPaystackPayment(reference);
  if(!verified)return status('pending');
  const activated=await activateVerifiedPayment(verified);
  return status(activated?'success':'pending');
 }catch(error){console.error('[billing] callback',error instanceof Error?error.name:'unknown');return status('pending');}
}
