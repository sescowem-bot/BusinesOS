'use server';
import {revalidatePath} from 'next/cache';
import {requireBusinessFeature} from '@/lib/server/authorization';
export type MappingState={error:string;success:string};
export async function savePosTaxMapping(_:MappingState,form:FormData):Promise<MappingState>{
 const product=String(form.get('product')||''),supply=String(form.get('supply')||'');
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(!uuid.test(product)||!uuid.test(supply))return {error:'Select a product and reviewed supply category.',success:''};
 try{
  const access=await requireBusinessFeature('pos');
  if(!access.allowed||!['owner','manager'].includes(access.role))return {error:'Only an authorised POS owner or manager can maintain these mappings.',success:''};
  const {error}=await access.client.rpc('business_set_product_tax_mapping',{p_business:access.businessId,p_product:product,p_supply:supply});
  if(error)return {error:error.code==='42883'||error.code==='PGRST202'?'Apply SQL 033 in staging first.':'The product mapping could not be saved. Check the product, category and your permissions.',success:''};
  revalidatePath('/pos');revalidatePath('/pos/tax-mapping');
  return {error:'',success:'Product mapped. This does not approve the category or its legal VAT treatment.'};
 }catch{return {error:'Unable to update the product category. Try again.',success:''};}
}
