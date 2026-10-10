'use server';
import {revalidatePath} from 'next/cache';
import {requireBusinessFeature} from '@/lib/server/authorization';
export type ReturnActionState={ok:boolean;message:string;returnId?:string;creditNoteId?:string};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(message:string):ReturnActionState=>({ok:false,message});
function refresh(){for(const path of ['/returns','/pos','/orders','/inventory','/products','/payments'])revalidatePath(path)}
export async function requestPosReturn(_:ReturnActionState,fd:FormData):Promise<ReturnActionState>{
 try{
  const access=await requireBusinessFeature('pos');if(!access.allowed)return fail(access.reason);
  if(!['owner','manager','sales'].includes(access.role))return fail('Only sales, manager or owner staff can submit return requests.');
  const order=String(fd.get('order')||''),item=String(fd.get('item')||''),request=String(fd.get('request_id')||'');
  const reason=String(fd.get('reason')||'').trim(),quantityText=String(fd.get('quantity')||'');
  const qty=Number(quantityText);
  if(![order,item,request].every(x=>UUID.test(x))||reason.length<10||reason.length>500||
   !/^\d{1,7}(?:\.\d{1,3})?$/.test(quantityText)||!Number.isFinite(qty)||qty<=0||qty>1000000)
   return fail('Choose a valid sale item, quantity and reason (10–500 characters).');
  const {data,error}=await access.client.rpc('business_request_pos_return',{
   p_business:access.businessId,p_order:order,p_item:item,p_quantity:qty,p_reason:reason,p_request:request
  });
  if(error)return fail(error.code==='42501'?'Return request access denied.':`Return request was not saved: ${error.message}`);
  refresh();return {ok:true,message:'Return submitted for owner/manager review. No money or stock has changed.',returnId:String(data)};
 }catch{return fail('Unable to request a return. Reload and verify the sale first.');}
}
export async function reviewPosReturn(_:ReturnActionState,fd:FormData):Promise<ReturnActionState>{
 try{
  const access=await requireBusinessFeature('pos');if(!access.allowed)return fail(access.reason);
  if(!['owner','manager'].includes(access.role))return fail('An owner or manager must review returns.');
  const id=String(fd.get('return_id')||''),decision=String(fd.get('decision')||''),note=String(fd.get('note')||'').trim();
  if(!UUID.test(id)||!['approve','reject'].includes(decision)||note.length>500)return fail('Review details are invalid.');
  if(fd.get('review_confirm')!=='yes')return fail('Confirm that you have reviewed the original sale and return evidence.');
  const {error}=await access.client.rpc('business_review_pos_return',{
   p_business:access.businessId,p_return:id,p_approve:decision==='approve',p_note:note
  });
  if(error)return fail(`Review could not be saved: ${error.message}`);
  refresh();revalidatePath(`/returns/${id}`);return {ok:true,message:decision==='approve'?'Return approved. No refund or stock restoration has occurred yet.':'Return rejected. The reserved quantity is released.'};
 }catch{return fail('Unable to review this return.');}
}
export async function completePosReturn(_:ReturnActionState,fd:FormData):Promise<ReturnActionState>{
 try{
  const access=await requireBusinessFeature('pos');if(!access.allowed)return fail(access.reason);
  if(!['owner','manager'].includes(access.role))return fail('Only owners or managers can confirm externally completed refunds.');
  const id=String(fd.get('return_id')||''),method=String(fd.get('method')||''),reference=String(fd.get('reference')||'').trim();
  const stock=String(fd.get('restock')||'');
  if(!UUID.test(id)||!['cash','transfer','external_pos','external_card','other'].includes(method)||
     !['yes','no'].includes(stock)||reference.length<3||reference.length>150||fd.get('confirmed')!=='yes')
   return fail('Confirm the actual refund, method, reference and returned-stock condition.');
  const {data,error}=await access.client.rpc('business_complete_pos_return',{
   p_business:access.businessId,p_return:id,p_method:method,p_reference:reference,p_restock:stock==='yes'
  });
  if(error)return fail(`Refund record was not completed: ${error.message}`);
  refresh();revalidatePath(`/returns/${id}`);
  return {ok:true,message:'Refund confirmation, credit note and stock decision recorded together. No bank transfer was initiated.',creditNoteId:String(data)};
 }catch{return fail('Unable to complete the return. Verify the external refund and current record status.');}
}
