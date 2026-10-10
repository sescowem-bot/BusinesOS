'use server';
import {revalidatePath} from 'next/cache';
import {getWorkspace} from '@/lib/server/workspace';
export type CostState={ok:boolean;message:string};
export async function recordOrderCost(_:CostState,fd:FormData):Promise<CostState>{
 try{
  const {client,businessId,role}=await getWorkspace();
  if(!['owner','manager','finance'].includes(role))return {ok:false,message:'Only owners, managers or finance users may record item costs.'};
  const order=String(fd.get('order')||''),raw=String(fd.get('cost')||'').trim();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order)||
   !/^\d{1,11}(?:\.\d{1,2})?$/.test(raw)||Number(raw)>9999999999.99||fd.get('confirmed')!=='yes')return {ok:false,message:'Enter a supported, confirmed cost per unit with up to two decimal places.'};
  const {error}=await client.rpc('business_record_missing_order_cost',{p_business:businessId,p_order:order,p_unit_cost:Number(raw)});
  if(error)return {ok:false,message:'Unit cost not saved: '+error.message};
  revalidatePath(`/orders/${order}`);revalidatePath('/dashboard');revalidatePath('/retail-reports');
  return {ok:true,message:'Item cost evidence saved. Estimated profit will now include this manual order.'};
 }catch{return {ok:false,message:'Unable to save cost evidence. Refresh and try again.'};}
}
