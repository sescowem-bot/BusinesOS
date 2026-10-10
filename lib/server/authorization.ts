import 'server-only';
import {getWorkspace} from './workspace';
import type {PaidFeature} from '@/lib/plan-catalog';

export type Feature = PaidFeature;
/** Access must be verified in SQL, not only in navigation or browser code. */
export async function requireBusinessFeature(feature:Feature){
 const workspace=await getWorkspace();
 const {data,error}=await workspace.client.rpc('business_has_feature',{p_business_id:workspace.businessId,p_feature_key:feature});
 if(error)return {...workspace,allowed:false,reason:'Unable to verify your subscription and role permissions. Contact platform support.'};
 return {...workspace,allowed:data===true,reason:'Your current plan or business role does not allow access to this module. Contact your business owner or request an upgrade.'};
}
