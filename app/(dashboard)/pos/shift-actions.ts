'use server';
import {revalidatePath} from 'next/cache';
import {requireBusinessFeature} from '@/lib/server/authorization';

export type CashierActionState={ok:boolean;message:string;shiftId?:string};
const fail=(message:string):CashierActionState=>({ok:false,message});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validMoney=(value:string,{allowZero=false}:{allowZero?:boolean}={})=>
 /^\d{1,12}(?:\.\d{1,2})?$/.test(value)&&Number.isFinite(Number(value))&&(allowZero?Number(value)>=0:Number(value)>0);
function refresh(id?:string){revalidatePath('/pos');revalidatePath('/pos/shifts');if(id)revalidatePath(`/pos/shifts/${id}`)}

export async function openCashierShift(_:CashierActionState,fd:FormData):Promise<CashierActionState>{
 try{
  const access=await requireBusinessFeature('pos');if(!access.allowed)return fail(access.reason);
  if(!['owner','manager','sales'].includes(access.role))return fail('Your role cannot open a cashier shift.');
  const opening=String(fd.get('opening_cash')||'');
  if(!validMoney(opening,{allowZero:true}))return fail('Enter a valid opening cash float with up to two decimals.');
  const {data,error}=await access.client.rpc('business_open_pos_shift',{p_business:access.businessId,p_opening:Number(opening)});
  if(error)return fail(`Could not open shift: ${error.message}`);
  refresh(String(data));return {ok:true,message:'Shift opened. Cash POS sales will now be linked to your active shift.',shiftId:String(data)};
 }catch{return fail('Unable to open shift. Check your role and refresh.');}
}
export async function recordCashMovement(_:CashierActionState,fd:FormData):Promise<CashierActionState>{
 try{
  const access=await requireBusinessFeature('pos');if(!access.allowed)return fail(access.reason);
  if(!['owner','manager','sales'].includes(access.role))return fail('Cashier permission required.');
  const id=String(fd.get('shift_id')||''),kind=String(fd.get('kind')||''),amount=String(fd.get('amount')||'');
  const reason=String(fd.get('reason')||'').trim(),reference=String(fd.get('reference')||'').trim();
  if(!UUID.test(id)||!['cash_in','cash_out'].includes(kind)||!validMoney(amount)||reason.length<10||reason.length>500||reference.length<3||reference.length>150)
   return fail('Provide a cash amount, a detailed reason and a unique voucher/reference.');
  const {error}=await access.client.rpc('business_add_pos_cash_movement',{
   p_business:access.businessId,p_shift:id,p_kind:kind,p_amount:Number(amount),p_reason:reason,p_reference:reference
  });
  if(error)return fail(`Cash movement not saved: ${error.message}`);
  refresh(id);return {ok:true,message:'Cash movement recorded in the shift audit history.',shiftId:id};
 }catch{return fail('Cash movement failed. Review the shift and voucher reference.');}
}
export async function closeCashierShift(_:CashierActionState,fd:FormData):Promise<CashierActionState>{
 try{
  const access=await requireBusinessFeature('pos');if(!access.allowed)return fail(access.reason);
  const id=String(fd.get('shift_id')||''),cash=String(fd.get('counted_cash')||''),note=String(fd.get('note')||'').trim();
  if(!UUID.test(id)||!validMoney(cash,{allowZero:true})||note.length>500||fd.get('verified')!=='yes')return fail('Confirm the counted cash, and add an optional closing note.');
  const {error}=await access.client.rpc('business_close_pos_shift',{
   p_business:access.businessId,p_shift:id,p_counted:Number(cash),p_note:note
  });
  if(error)return fail(`Shift could not be closed: ${error.message}`);
  refresh(id);return {ok:true,message:'Shift closed. Expected cash, physical count and variance are now frozen for management review.',shiftId:id};
 }catch{return fail('Unable to close the shift. Recount your cash and try again.');}
}
export async function reviewCashierShift(_:CashierActionState,fd:FormData):Promise<CashierActionState>{
 try{
  const access=await requireBusinessFeature('pos');if(!access.allowed)return fail(access.reason);
  if(!['owner','manager'].includes(access.role))return fail('Only business owner or manager may review shifts.');
  const id=String(fd.get('shift_id')||''),decision=String(fd.get('decision')||''),note=String(fd.get('note')||'').trim();
  if(!UUID.test(id)||!['approve','flag'].includes(decision)||note.length>500||fd.get('reviewed')!=='yes')return fail('Confirm the review, decision and any supporting note.');
  const {error}=await access.client.rpc('business_review_pos_shift',{
   p_business:access.businessId,p_shift:id,p_approve:decision==='approve',p_note:note
  });
  if(error)return fail(`Review not saved: ${error.message}`);
  refresh(id);return {ok:true,message:decision==='approve'?'Cashier shift reviewed. The recorded variance remains unchanged.':'Shift flagged for further investigation.',shiftId:id};
 }catch{return fail('Unable to record review.');}
}
