'use server';
import {revalidatePath} from 'next/cache';
import {requireBusinessFeature} from '@/lib/server/authorization';
export type FinanceState={error:string;success:string};
const fail=(error:string):FinanceState=>({error,success:''});
export async function createAccount(_:FinanceState,fd:FormData):Promise<FinanceState>{
 try{const access=await requireBusinessFeature('accounting');if(!access.allowed)return fail(access.reason);const {client,businessId}=access;
 const code=String(fd.get('code')||'').trim(),name=String(fd.get('name')||'').trim(),kind=String(fd.get('class')||'');
 if(!code||code.length>30||!name||name.length>160)return fail('Enter a valid code and account name.');
 const {error}=await client.rpc('gl_add_account',{p_business:businessId,p_code:code,p_name:name,p_class:kind});if(error)return fail(error.message);revalidatePath('/accounting');return {error:'',success:'Account created.'};}catch{return fail('Unable to create account.');}
}
export async function createPeriod(_:FinanceState,fd:FormData):Promise<FinanceState>{
 try{const access=await requireBusinessFeature('accounting');if(!access.allowed)return fail(access.reason);const {client,businessId}=access;
 const name=String(fd.get('name')||'').trim(),start=String(fd.get('start')||''),end=String(fd.get('end')||'');
 if(!name||name.length>80||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end))return fail('Enter a valid period.');
 const {error}=await client.rpc('gl_create_period',{p_business:businessId,p_name:name,p_start:start,p_end:end});if(error)return fail(error.message);revalidatePath('/accounting');return {error:'',success:'Accounting period opened.'};}catch{return fail('Unable to open accounting period.');}
}
export async function postJournal(_:FinanceState,fd:FormData):Promise<FinanceState>{
 try{const access=await requireBusinessFeature('accounting');if(!access.allowed)return fail(access.reason);const {client,businessId}=access;
 const date=String(fd.get('date')||''),description=String(fd.get('description')||'').trim(),reference=String(fd.get('reference')||'').trim();
 const a=String(fd.get('debit_account')||''),b=String(fd.get('credit_account')||'');const raw=String(fd.get('amount')||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!description||description.length>500||a===b||!/^\d+(\.\d{1,2})?$/.test(raw)||Number(raw)<=0)return fail('Enter a valid date, description, distinct accounts and positive amount.');
 const amount=Number(raw);
 const {error}=await client.rpc('gl_post_journal',{p_business:businessId,p_date:date,p_description:description,p_reference:reference,p_lines:[{account_id:a,debit:amount,credit:0},{account_id:b,debit:0,credit:amount}]});
 if(error)return fail(error.message);revalidatePath('/accounting');return {error:'',success:'Balanced journal posted.'};}catch{return fail('Unable to post journal.');}
}
