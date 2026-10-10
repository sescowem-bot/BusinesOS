'use server';
import {revalidatePath} from 'next/cache';
import {requireBusinessFeature} from '@/lib/server/authorization';
export type ExpenseResult={error:string;success:string};
export async function createPaidExpense(_:ExpenseResult,fd:FormData):Promise<ExpenseResult>{
 try{
  const a=await requireBusinessFeature('expenses');
  if(!a.allowed)return {error:a.reason,success:''};
  if(!['owner','manager','finance'].includes(a.role))return {error:'Finance permission required.',success:''};
  const description=String(fd.get('description')||'').trim();
  const raw=String(fd.get('amount')||'');
  const date=String(fd.get('paid_on')||'');
  if(description.length<3||description.length>300||!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(raw)||Number(raw)<=0||Number(raw)>999999999||!/^\d{4}-\d{2}-\d{2}$/.test(date))return {error:'Enter a valid expense date, description and positive amount.',success:''};
  const {error}=await a.client.rpc('gl_record_paid_expense',{p_business:a.businessId,p_description:description,p_amount:Number(raw),p_paid_at:`${date}T12:00:00+00:00`});
  if(error)return {error:error.message,success:''};
  revalidatePath('/expenses');revalidatePath('/accounting');revalidatePath('/reports');
  return {error:'',success:'Paid expense recorded. Check Accounting to confirm journal status.'};
 }catch{return {error:'Unable to record the expense. Please try again.',success:''};}
}
