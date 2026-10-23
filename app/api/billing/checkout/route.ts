import {NextRequest,NextResponse} from 'next/server';
import {getWorkspace} from '@/lib/server/workspace';
import {billingReady,billingAdmin} from '@/lib/server/billing';
import {priceToKobo} from '@/lib/phase3/billing-policy';
export const runtime='nodejs';
export async function POST(request:NextRequest){
 const origin=new URL(request.url).origin;
 if(request.headers.get('origin')!==origin)return NextResponse.json({message:'Please restart checkout from BusinessOS.'},{status:403});
 if(!billingReady())return NextResponse.redirect(new URL('/upgrade?checkout=unavailable',origin),303);
 try{
  const {client,businessId,role,userId}=await getWorkspace();
  if(role!=='owner')return NextResponse.redirect(new URL('/upgrade?checkout=owner',origin),303);
  const form=await request.formData();
  const planId=String(form.get('plan_id')||'');const cycle=String(form.get('cycle')||'monthly');
  if(!/^[a-z0-9][a-z0-9_-]{0,69}$/.test(planId)||!['monthly','yearly'].includes(cycle)||planId==='free')return NextResponse.redirect(new URL('/upgrade?checkout=invalid',origin),303);
  const [planLookup,userLookup,currentLookup]=await Promise.all([
   client.from('public_site_plans').select('id,price_monthly_ngn,price_yearly_ngn').eq('id',planId).eq('published',true).maybeSingle(),client.auth.getUser(),
   client.from('business_plan_assignments').select('plan_id,expires_at').eq('business_id',businessId).maybeSingle()
  ]);
  // Fail closed if the published plan, authenticated owner, or active subscription cannot be verified.
  if(planLookup.error||userLookup.error||currentLookup.error)
   return NextResponse.redirect(new URL('/upgrade?checkout=unavailable',origin),303);
  const plan=planLookup.data,user=userLookup.data.user,current=currentLookup.data;
  // Do not erase an already-paid, unexpired period by switching plans without proration.
  if(current?.plan_id && current.plan_id!=='free'&&current.plan_id!==planId&&current.expires_at&&new Date(current.expires_at)>new Date())
   return NextResponse.redirect(new URL('/upgrade?checkout=switch',origin),303);
  const kobo=priceToKobo(cycle==='yearly'?plan?.price_yearly_ngn:plan?.price_monthly_ngn);
  if(!plan||!user?.email||user.id!==userId||kobo===null)
   return NextResponse.redirect(new URL('/upgrade?checkout=unavailable',origin),303);
  const reference='bos_'+crypto.randomUUID().replaceAll('-','');
  const admin=billingAdmin();
  const {error:insertError}=await admin.from('business_subscription_payments').insert({reference,business_id:businessId,owner_id:userId,plan_id:planId,billing_cycle:cycle,amount_kobo:kobo});
  if(insertError){console.error('[billing] record',insertError.code);return NextResponse.redirect(new URL('/upgrade?checkout=failed',origin),303);}
  const response=await fetch('https://api.paystack.co/transaction/initialize',{
   method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.PAYSTACK_SECRET_KEY}`},
   body:JSON.stringify({email:user.email,amount:kobo,currency:'NGN',reference,callback_url:`${origin}/api/billing/verify?reference=${encodeURIComponent(reference)}`,metadata:{business_id:businessId,plan_id:planId,billing_cycle:cycle}}),
   cache:'no-store',signal:AbortSignal.timeout(15000)
  });
  if(!response.ok)return NextResponse.redirect(new URL('/upgrade?checkout=failed',origin),303);
  const result=await response.json() as {status?:boolean;data?:{authorization_url?:string}};
  const paymentUrl=result.data?.authorization_url;
  if(!result.status||!paymentUrl)return NextResponse.redirect(new URL('/upgrade?checkout=failed',origin),303);
  const destination=new URL(paymentUrl);
  if(destination.protocol!=='https:' || !(destination.hostname==='paystack.com'||destination.hostname.endsWith('.paystack.com')))return NextResponse.redirect(new URL('/upgrade?checkout=failed',origin),303);
  return NextResponse.redirect(paymentUrl,303);
 }catch(error){console.error('[billing] initialization error',error instanceof Error?error.name:'unknown');return NextResponse.redirect(new URL('/upgrade?checkout=failed',origin),303);}
}
