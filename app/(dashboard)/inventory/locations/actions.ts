'use server';
import {revalidatePath} from 'next/cache';
import {requireBusinessFeature} from '@/lib/server/authorization';
export type LocationActionState={error:string;success:string};
const fail=(error:string):LocationActionState=>({error,success:''});
const ok=(success:string):LocationActionState=>({error:'',success});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validQty=(n:number)=>Number.isFinite(n)&&n>0&&n<=1000000&&Math.abs(n*1000-Math.round(n*1000))<1e-6;
const reload=()=>{revalidatePath('/inventory');revalidatePath('/inventory/locations');revalidatePath('/pos');};
export async function enableBranchLocation(_:LocationActionState,fd:FormData):Promise<LocationActionState>{
 try{const a=await requireBusinessFeature('inventory');if(!a.allowed)return fail(a.reason);
 if(!['owner','manager'].includes(a.role))return fail('Only owners and managers can enable branch stock.');
 const branch=String(fd.get('branch')||'');if(!UUID.test(branch))return fail('Select a valid branch.');
 const {error}=await a.client.rpc('business_enable_branch_stock',{p_business:a.businessId,p_branch:branch});
 if(error)return fail(`Branch location could not be enabled: ${error.message}`);
 reload();return ok('Branch stock location enabled. Allocate quantities from Unallocated using a transfer.');
 }catch{return fail('Unable to enable branch stock location.');}
}
export async function transferBranchStock(_:LocationActionState,fd:FormData):Promise<LocationActionState>{
 try{const a=await requireBusinessFeature('inventory');if(!a.allowed)return fail(a.reason);
 if(!['owner','manager'].includes(a.role))return fail('Only owners and managers may transfer stock.');
 const request=String(fd.get('request')||''),item=String(fd.get('product')||''),source=String(fd.get('from')||''),target=String(fd.get('to')||'');
 const qty=Number(fd.get('quantity')),reason=String(fd.get('reason')||'').trim();
 if(![request,item,source,target].every(x=>UUID.test(x))||source===target||!validQty(qty)||reason.length<5||reason.length>500)
  return fail('Choose two different locations, a tracked product, a valid quantity and a reason.');
 const {error}=await a.client.rpc('business_transfer_location_stock',{p_business:a.businessId,p_request:request,p_product:item,p_from:source,p_to:target,p_quantity:qty,p_reason:reason});
 if(error)return fail(`Stock transfer failed: ${error.message}`);
 reload();return ok('Stock transferred between locations. The company-wide stock total was not changed.');
 }catch{return fail('Unable to record the transfer.');}
}
export async function countBranchStock(_:LocationActionState,fd:FormData):Promise<LocationActionState>{
 try{const a=await requireBusinessFeature('inventory');if(!a.allowed)return fail(a.reason);
 if(!['owner','manager','inventory'].includes(a.role))return fail('Inventory role required.');
 const request=String(fd.get('request')||''),location=String(fd.get('location')||''),item=String(fd.get('product')||'');
 const expected=Number(fd.get('expected')),counted=Number(fd.get('counted')),reason=String(fd.get('reason')||'').trim();
 if(![request,location,item].every(x=>UUID.test(x))||![expected,counted].every(x=>Number.isFinite(x)&&x>=0&&x<=99999999999&&Math.abs(x*1000-Math.round(x*1000))<1e-6)||reason.length<5||reason.length>500)
  return fail('Select a location and product, enter both valid quantities and a reason.');
 const {error}=await a.client.rpc('business_count_location_stock',{p_business:a.businessId,p_request:request,p_location:location,p_product:item,p_expected:expected,p_counted:counted,p_reason:reason});
 if(error)return fail(error.code==='40001'?'Stock changed since you opened the page. Reload before counting again.':`Stock count failed: ${error.message}`);
 reload();return ok('Location stock count recorded with its variance and audit history.');
 }catch{return fail('Unable to record stock count.');}
}
