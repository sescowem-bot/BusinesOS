"use server";
import {revalidatePath} from 'next/cache';
import {getWorkspace} from '@/lib/server/workspace';
export type TaxActionState={error:string;success:string};
const ALLOWED=['retail','fashion','food','beauty','manufacturing','professional_services','healthcare','education','hospitality','technology','agriculture','construction','other'];
export async function saveTaxProfile(_:TaxActionState, form:FormData):Promise<TaxActionState>{
 const {client,businessId:activeBusiness,role}=await getWorkspace();
 const businessId=String(form.get('business_id')||'');
 if(!/^[0-9a-f-]{36}$/i.test(businessId))return {error:'Invalid business workspace.',success:''};
 if(activeBusiness!==businessId||role!=='owner')return {error:'Only the owner of the selected business may edit its tax profile.',success:''};
 const legal=String(form.get('legal_structure')||'unknown');
 const turnover=String(form.get('turnover_band')||'unknown');
 const vat=String(form.get('vat_registration_status')||'unknown');
 if(!['unknown','individual','business_name','company','partnership','other'].includes(legal)||!['unknown','under_50m','50m_100m','over_100m'].includes(turnover)||!['unknown','registered','not_registered','pending'].includes(vat))return {error:'Invalid tax profile selection.',success:''};
 const activities=form.getAll('activities').map(String).filter(x=>ALLOWED.includes(x));
 const unique=[...new Set(activities)];
 if(unique.length===0)return {error:'Select at least one activity.',success:''};
 const goodsServices=String(form.get('goods_services')||'').trim();
 const notes=String(form.get('notes')||'').trim();
 if(goodsServices.length>2000||notes.length>1000)return {error:'Description is too long.',success:''};
 const staff=String(form.get('employs_staff')||'unknown');
 if(!['yes','no','unknown'].includes(staff))return {error:'Invalid staff selection.',success:''};
 const {error}=await client.from('business_tax_profiles').upsert({business_id:businessId,legal_structure:legal,turnover_band:turnover,vat_registration_status:vat,employs_staff:staff==='unknown'?null:staff==='yes',activities:unique,goods_services:goodsServices,notes,classification_status:'needs_review',updated_at:new Date().toISOString()},{onConflict:'business_id'});
 if(error)return {error:'Unable to save. Ensure SQL migration 005 is installed and your account is the business owner.',success:''};
 revalidatePath('/tax-profile');return {error:'',success:'Tax discovery profile saved. Your supplies still require classification review.'};
}
export async function addSupply(_:TaxActionState,form:FormData):Promise<TaxActionState>{
 const {client,businessId:activeBusiness,role}=await getWorkspace();
 const id=String(form.get('business_id')||'');
 if(activeBusiness!==id||role!=='owner')return {error:'Only the owner of the selected business may add supplies.',success:''};
 const name=String(form.get('name')||'').trim();const kind=String(form.get('supply_kind')||'');
 if(name.length<2||name.length>120||!['goods','services','mixed'].includes(kind))return {error:'Enter a valid supply name and type.',success:''};
 const {error}=await client.from('business_supply_categories').insert({business_id:id,name,supply_kind:kind,proposed_vat_treatment:'needs_review'});
 if(error)return {error:'Unable to add supply. It may already exist or migration 005 is missing.',success:''};
 revalidatePath('/tax-profile');return {error:'',success:'Supply added to the review list.'};
}
