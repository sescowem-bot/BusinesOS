import 'server-only';
import {redirect} from 'next/navigation';
import {getWorkspace} from './workspace';
import type {PaidFeature} from '@/lib/plan-catalog';
import {getWorkspaceVisibleModules} from './visible-modules';

export type Feature = PaidFeature;
/** Access must be verified in SQL, not only in navigation or browser code. */
/** Denied premium URLs return to the workspace home (no upsell or 404 page).
 * Only pass optional:true when checking whether to show a sub-feature or link.
 * SQL/RLS/RPC permission checks are still the authority for any data operation. */
export async function requireBusinessFeature(feature:Feature,options:{optional?:boolean}={}){
 const workspace=await getWorkspace();
 const {data,error}=await workspace.client.rpc('business_has_feature',{p_business_id:workspace.businessId,p_feature_key:feature});
 if(error){
  if(!options.optional)redirect('/dashboard');
  return {...workspace,allowed:false,reason:'Unable to verify your subscription and role permissions. Contact platform support.'};
 }
 const visibility=await getWorkspaceVisibleModules();
 const allowed=data===true&&!visibility.error&&visibility.modules.includes(feature);
 if(!allowed&&!options.optional)redirect('/dashboard');
 return {...workspace,allowed,reason:'This feature is not available to your business account.'};
}
