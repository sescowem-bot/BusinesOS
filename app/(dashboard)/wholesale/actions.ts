'use server';
import {revalidatePath} from 'next/cache';
import {requireBusinessFeature} from '@/lib/server/authorization';
export type WholesaleState={ok:boolean;message:string};
const invalid=(message:string):WholesaleState=>({ok:false,message});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function refreshed(){revalidatePath('/wholesale');revalidatePath('/products');}
export async function saveWholesaleTier(_:WholesaleState,fd:FormData):Promise<WholesaleState>{
 try{
 const a=await requireBusinessFeature('pos');if(!a.allowed)return invalid(a.reason);
 if(!['owner','manager'].includes(a.role))return invalid('Only a business owner or manager may change bulk pricing.');
 const product=String(fd.get('product')||''),qtyText=String(fd.get('quantity')||''),priceText=String(fd.get('price')||''),note=String(fd.get('note')||'').trim();
 const qty=Number(qtyText),price=Number(priceText);
 if(!uuid.test(product)||!/^[0-9]{1,7}(?:\.[0-9]{1,3})?$/.test(qtyText)||qty<2||qty>1000000||
 !/^[0-9]{1,10}(?:\.[0-9]{1,2})?$/.test(priceText)||price<=0||!Number.isFinite(qty)||!Number.isFinite(price)||note.length>250)
 return invalid('Enter a minimum quantity of at least 2 and a valid discounted unit price.');
 const {error}=await a.client.rpc('business_set_wholesale_price_tier',{p_business:a.businessId,p_product:product,p_min_qty:qty,p_price:price,p_note:note});
 if(error)return invalid(`Could not save tier: ${error.message}`);
 refreshed();return {ok:true,message:'Wholesale reference tier saved. POS catalogue prices and VAT calculations have not changed.'};
 }catch{return invalid('Unable to save wholesale pricing right now.');}
}
export async function removeWholesaleTier(_:WholesaleState,fd:FormData):Promise<WholesaleState>{
 try{const a=await requireBusinessFeature('pos');if(!a.allowed)return invalid(a.reason);
 if(!['owner','manager'].includes(a.role))return invalid('Owner/manager permission required.');
 const tier=String(fd.get('tier')||'');if(!uuid.test(tier)||fd.get('confirm')!=='yes')return invalid('Choose and confirm a valid tier.');
 const {error}=await a.client.rpc('business_delete_wholesale_price_tier',{p_business:a.businessId,p_tier:tier});
 if(error)return invalid(`Tier could not be removed: ${error.message}`);
 refreshed();return {ok:true,message:'Reference price tier removed.'};
 }catch{return invalid('Unable to remove wholesale price tier.');}
}
