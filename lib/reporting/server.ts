import 'server-only';
import {requireBusinessFeature} from '@/lib/server/authorization';
import type {TrialRow} from './financial';
export async function financialContext(){
 const ctx=await requireBusinessFeature('financial_reports');
 if(!ctx.allowed)throw new Error(ctx.reason);
 return ctx;
}
export async function loadTrial(){
 const {client,businessId}=await financialContext();
 const {data,error}=await client.from('gl_trial_balance').select('account_id,code,name,class,debit_turnover,credit_turnover,signed_balance').eq('business_id',businessId).order('code');
 if(error)throw new Error('Unable to read posted trial balance');
 return (data||[]).map(x=>({...x,debit_turnover:Number(x.debit_turnover),credit_turnover:Number(x.credit_turnover),signed_balance:Number(x.signed_balance)})) as TrialRow[];
}
