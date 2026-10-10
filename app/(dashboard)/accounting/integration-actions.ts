'use server';
import {revalidatePath} from 'next/cache';
import {requireBusinessFeature} from '@/lib/server/authorization';

export type IntegrationResult={error:string;success:string};
const failure=(error:string):IntegrationResult=>({error,success:''});
const refresh=()=>{revalidatePath('/accounting');revalidatePath('/reports');revalidatePath('/expenses');};

export async function configureAccounting(_:IntegrationResult,form:FormData):Promise<IntegrationResult>{
 try{
  const access=await requireBusinessFeature('accounting');
  if(!access.allowed)return failure(access.reason);
  if(!['owner','manager','finance'].includes(access.role))return failure('Finance permission required.');
  const selected=['cash','receivable','advance','income','delivery','tax','expense'] as const;
  const ids=Object.fromEntries(selected.map(k=>[k,String(form.get(k)||'')]));
  if(selected.some(k=>!/^[a-f0-9-]{36}$/i.test(ids[k])))return failure('Select an account for every mapping.');
  const enabled=form.get('enabled')==='yes';
  if(enabled && form.get('confirm_policy')!=='yes')return failure('Confirm the posting policy before enabling automatic journals.');
  const {error}=await access.client.rpc('gl_configure_integration',{
   p_business:access.businessId,p_enabled:enabled,
   p_cash:ids.cash,p_receivable:ids.receivable,p_advance:ids.advance,
   p_income:ids.income,p_delivery:ids.delivery,p_tax:ids.tax,p_expense:ids.expense,
  });
  if(error)return failure(error.message);
  refresh();return {error:'',success:enabled?'Automatic posting enabled for new events.':'Automatic posting paused. Existing journals remain unchanged.'};
 }catch{return failure('Unable to save accounting integration settings.');}
}
export async function discoverAccountingSources(_:IntegrationResult):Promise<IntegrationResult>{
 try{
  const access=await requireBusinessFeature('accounting');if(!access.allowed)return failure(access.reason);
  if(!['owner','manager','finance'].includes(access.role))return failure('Finance permission required.');
  const {data,error}=await access.client.rpc('gl_discover_existing_sources',{p_business:access.businessId});
  if(error)return failure(error.message);
  refresh();return {error:'',success:`Added previously unqueued source records. ${JSON.stringify(data)}. Review them before posting.`};
 }catch{return failure('Unable to discover existing transactions.');}
}
export async function processAccountingSources(_:IntegrationResult):Promise<IntegrationResult>{
 try{
  const access=await requireBusinessFeature('accounting');if(!access.allowed)return failure(access.reason);
  if(!['owner','manager','finance'].includes(access.role))return failure('Finance permission required.');
  const {data,error}=await access.client.rpc('gl_process_accounting_queue',{p_business:access.businessId,p_limit:20});
  if(error)return failure(error.message);
  refresh();const posted=(data as {posted?:number}|null)?.posted??0,failed=(data as {failed?:number}|null)?.failed??0;
  return {error:'',success:`Processed this batch: ${posted} posted, ${failed} needing review. Check the event list before continuing.`};
 }catch{return failure('Unable to process accounting events.');}
}
