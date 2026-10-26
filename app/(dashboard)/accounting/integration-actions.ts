'use server';
import {friendlyServiceError} from '@/lib/user-feedback';
import {revalidatePath} from 'next/cache';
import {requireBusinessFeature} from '@/lib/server/authorization';
import {premiumActionAllowed} from '@/lib/server/core-action-permissions';

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
  if(!(await premiumActionAllowed(access,'accounting','edit')))return failure('This accounting operation is not permitted for the plan or staff role.');
  if(enabled){
   const {count,error:productsError}=await access.client.from('products').select('id',{head:true,count:'exact'}).eq('business_id',access.businessId).eq('track_inventory',true);
   if(productsError)return failure('Unable to verify tracked products. Please retry.');
   if((count||0)>0){
    const {data:stockSettings,error:stockError}=await access.client.from('gl_inventory_cost_settings')
     .select('inventory_account_id,cogs_account_id').eq('business_id',access.businessId).maybeSingle();
    if(stockError||!stockSettings)return failure('Configure Inventory Asset and Cost of Goods Sold accounts before enabling posting for a business with tracked stock.');
   }
  }
 const {error}=await access.client.rpc('gl_configure_integration',{
   p_business:access.businessId,p_enabled:enabled,
   p_cash:ids.cash,p_receivable:ids.receivable,p_advance:ids.advance,
   p_income:ids.income,p_delivery:ids.delivery,p_tax:ids.tax,p_expense:ids.expense,
  });
  if(error)return failure(friendlyServiceError('complete this request', error));
  refresh();return {error:'',success:enabled?'Automatic posting enabled for new ordinary invoices, POS sales, payments, refunds and expenses.':'Automatic posting paused. Existing journals remain unchanged.'};
 }catch{return failure('Unable to save accounting integration settings.');}
}
export async function configureInventoryCostAccounts(_:IntegrationResult,form:FormData):Promise<IntegrationResult>{
 try{
  const access=await requireBusinessFeature('accounting');
  if(!access.allowed)return failure(access.reason);
  if(!['owner','manager','finance'].includes(access.role))return failure('Finance permission required.');
  if(!(await premiumActionAllowed(access,'accounting','edit')))return failure('Accounting account mappings are not permitted for the plan or staff role.');
  const inventory=String(form.get('inventory')||''),cogs=String(form.get('cogs')||'');
  const uuid=/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
  if(!uuid.test(inventory)||!uuid.test(cogs)||inventory===cogs)return failure('Choose separate, valid Inventory Asset and Cost of Goods Sold accounts.');
  if(form.get('confirm_cost_policy')!=='yes')return failure('Please confirm your stock valuation and cost recording policy before saving.');
  const {error}=await access.client.rpc('gl_configure_inventory_cost_accounts',{
   p_business:access.businessId,p_inventory:inventory,p_cogs:cogs
  });
  if(error)return failure(friendlyServiceError('save inventory cost accounts',error));
  refresh();
  return {error:'',success:'Inventory Asset and Cost of Goods Sold accounts saved. Future tracked POS postings will use the cost recorded at sale.'};
 }catch{return failure('Unable to configure the inventory cost accounts.');}
}

export async function discoverAccountingSources(_:IntegrationResult):Promise<IntegrationResult>{
 try{
  const access=await requireBusinessFeature('accounting');if(!access.allowed)return failure(access.reason);
  if(!['owner','manager','finance'].includes(access.role))return failure('Finance permission required.');
  if(!(await premiumActionAllowed(access,'accounting','create')))return failure('This accounting operation is not permitted for the plan or staff role.');
 const {data,error}=await access.client.rpc('gl_discover_existing_sources',{p_business:access.businessId});
  if(error)return failure(friendlyServiceError('complete this request', error));
  refresh();return {error:'',success:`Added previously unqueued source records. ${JSON.stringify(data)}. Review them before posting.`};
 }catch{return failure('Unable to discover existing transactions.');}
}
export async function processAccountingSources(_:IntegrationResult):Promise<IntegrationResult>{
 try{
  const access=await requireBusinessFeature('accounting');if(!access.allowed)return failure(access.reason);
  if(!['owner','manager','finance'].includes(access.role))return failure('Finance permission required.');
  if(!(await premiumActionAllowed(access,'accounting','approve')))return failure('This accounting operation is not permitted for the plan or staff role.');
 const {data,error}=await access.client.rpc('gl_process_accounting_queue',{p_business:access.businessId,p_limit:20});
  if(error)return failure(friendlyServiceError('complete this request', error));
  refresh();const posted=(data as {posted?:number}|null)?.posted??0,failed=(data as {failed?:number}|null)?.failed??0;
  return {error:'',success:`Processed this batch: ${posted} posted, ${failed} needing review. Check the event list before continuing.`};
 }catch{return failure('Unable to process accounting events.');}
}
