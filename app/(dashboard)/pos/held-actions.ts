'use server';
import {revalidatePath} from 'next/cache';
import {requireBusinessFeature} from '@/lib/server/authorization';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Draft={id:string;label:string;locationId:string;customerId:string;basket:{product_id:string;quantity:number}[];priceMode:'inclusive'|'exclusive';discount:number};
type Result={ok:boolean;message:string};
export async function savePosCart(draft:Draft):Promise<Result>{
 try{
  const access=await requireBusinessFeature('pos');
  if(!access.allowed||!['owner','manager','sales'].includes(access.role))return {ok:false,message:'POS access denied.'};
  if(!UUID.test(draft.id)||!UUID.test(draft.locationId)||(draft.customerId&&!UUID.test(draft.customerId))||
    draft.label.trim().length<2||draft.label.length>80||!['inclusive','exclusive'].includes(draft.priceMode)||
    !Number.isFinite(draft.discount)||draft.discount<0||draft.discount>999999999||Math.abs(Math.round(draft.discount*100)-draft.discount*100)>1e-6||
    !Array.isArray(draft.basket)||draft.basket.length<1||draft.basket.length>30||
    new Set(draft.basket.map(x=>x.product_id)).size!==draft.basket.length||
    draft.basket.some(x=>!UUID.test(x.product_id)||!Number.isFinite(x.quantity)||x.quantity<=0||x.quantity>1000000||Math.abs(Math.round(x.quantity*1000)-x.quantity*1000)>1e-6))
   return {ok:false,message:'Please enter a valid cart name, products and quantities.'};
  const {error}=await access.client.rpc('business_save_pos_cart',{
   p_business:access.businessId,p_cart:draft.id,p_label:draft.label.trim(),p_location:draft.locationId,
   p_customer:draft.customerId||null,p_basket:draft.basket,p_price_mode:draft.priceMode,p_discount:draft.discount
  });
  if(error)return {ok:false,message:`Unable to hold cart: ${error.message}`};
  revalidatePath('/pos');return {ok:true,message:'Cart saved. Prices, stock and VAT are rechecked when resumed and checked out.'};
 }catch{return {ok:false,message:'Could not save held cart.'};}
}
export async function discardPosCart(cartId:string):Promise<Result>{
 try{
  const access=await requireBusinessFeature('pos');if(!access.allowed||!['owner','manager','sales'].includes(access.role)||!UUID.test(cartId))return {ok:false,message:'Not authorised.'};
  const {error}=await access.client.rpc('business_delete_pos_cart',{p_business:access.businessId,p_cart:cartId});
  if(error)return {ok:false,message:`Cannot discard cart: ${error.message}`};
  revalidatePath('/pos');return {ok:true,message:'Held cart discarded.'};
 }catch{return {ok:false,message:'Could not discard cart.'};}
}
