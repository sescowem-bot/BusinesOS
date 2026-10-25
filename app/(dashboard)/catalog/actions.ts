'use server';
import {friendlyServiceError} from '@/lib/user-feedback';
import {usageLimitFeedback} from '@/lib/phase3/usage-limit-feedback';
import {revalidatePath} from 'next/cache';
import {getWorkspace} from '@/lib/server/workspace';
import {requireBusinessFeature} from '@/lib/server/authorization';
import {coreActionAllowed,premiumActionAllowed} from '@/lib/server/core-action-permissions';
export type CatalogState={error:string;success:string};
const fail=(error:string):CatalogState=>({error,success:''});
export async function addCatalogItem(_:CatalogState,fd:FormData):Promise<CatalogState>{
 try {const access=await getWorkspace();const {client,businessId}=access;
 if(!['owner','manager','inventory'].includes(access.role)||!(await coreActionAllowed(access,'products','create')))return fail('You cannot add products or services with this plan or staff role.');
 const name=String(fd.get('name')||'').trim(),type=String(fd.get('type')||'product'),sku=String(fd.get('sku')||'').trim(),description=String(fd.get('description')||'').trim();
 const price=Number(fd.get('price')),cost=Number(fd.get('cost')),stock=Number(fd.get('stock')||0),minimum=Number(fd.get('minimum')||0),track=fd.get('track')==='on'&&type!=='service';
 if(!name||name.length>160||sku.length>100||description.length>2000||!['product','service','package'].includes(type)||![price,cost,stock,minimum].every(v=>Number.isFinite(v)&&v>=0)||(!track&&stock!==0))return fail('Check the item, amounts, and inventory tracking settings.');
 if(track||minimum>0){const inventory=await requireBusinessFeature('inventory');if(!inventory.allowed)return fail(inventory.reason);if(!(await premiumActionAllowed(inventory,'inventory','create')))return fail('Stock tracking is not available for this plan or staff role.');}
 const {error}=await client.rpc('catalog_create_item',{p_business:businessId,p_name:name,p_type:type,p_sku:sku||null,p_description:description||null,p_price:price,p_cost:cost,p_track:track,p_initial_stock:stock,p_minimum:minimum});
 if(error)return fail(usageLimitFeedback(error)||'Item could not be saved. Review the details and try again.');
 revalidatePath('/products');revalidatePath('/inventory');return {error:'',success:'Item created successfully.'};
 }catch{return fail('Unable to create item.');}
}
export async function adjustStock(_:CatalogState,fd:FormData):Promise<CatalogState>{
 try{const access=await requireBusinessFeature('inventory');if(!access.allowed)return fail(access.reason);const {client,businessId}=access;if(!['owner','manager','inventory'].includes(access.role))return fail('Inventory role required.');const item=String(fd.get('item')||''),delta=Number(fd.get('delta')),reason=String(fd.get('reason')||'').trim();
 if(!(await premiumActionAllowed(access,'inventory','edit')))return fail('Your plan or staff role cannot adjust stock.');
 if(!item||!Number.isFinite(delta)||delta===0||Math.abs(delta)>100000000||Math.round(delta*1000)!==delta*1000||reason.length<3||reason.length>500)return fail('Choose a product, nonzero quantity change, and explanation.');
 const {error}=await client.rpc('inventory_adjust_stock',{p_business:businessId,p_item:item,p_delta:delta,p_reason:reason});
 if(error)return fail('Stock could not be updated. Please check the quantity and try again.');
 revalidatePath('/inventory');revalidatePath('/products');return {error:'',success:'Stock adjusted and movement recorded.'};
 }catch{return fail('Unable to update stock.');}
}

/** Physical stock counts are optimistic and never silently override changed stock. */
export async function recordStockCount(_:CatalogState,fd:FormData):Promise<CatalogState>{
 try{
  const access=await requireBusinessFeature('inventory');
  if(!access.allowed)return fail(access.reason);
  if(!['owner','manager','inventory'].includes(access.role))return fail('Inventory role required.');
  if(!(await premiumActionAllowed(access,'inventory','edit')))return fail('Your plan or staff role cannot record stock counts.');
  const item=String(fd.get('item')||'');
  const expected=Number(fd.get('expected'));
  const counted=Number(fd.get('counted'));
  const reason=String(fd.get('reason')||'').trim();
  const validQuantity=(n:number)=>Number.isFinite(n)&&n>=0&&n<=99999999999&&Math.round(n*1000)===n*1000;
  if(!/^[0-9a-f-]{36}$/i.test(item)||!validQuantity(expected)||!validQuantity(counted)||reason.length<5||reason.length>500)
   return fail('Select a product and enter a valid count, expected balance and reason.');
  const {error}=await access.client.rpc('inventory_record_stock_count',{
   p_business:access.businessId,p_item:item,p_expected:expected,p_counted:counted,p_reason:reason
  });
  if(error)return fail(error.code==='40001'?'Stock has changed. Reload the page and count again.':friendlyServiceError('complete this request', error));
  revalidatePath('/inventory');revalidatePath('/products');
  return {error:'',success:counted===expected?'Stock count verified; no adjustment required.':'Stock count saved and difference recorded.'};
 }catch{return fail('Unable to save stock count. Please try again.');}
}
