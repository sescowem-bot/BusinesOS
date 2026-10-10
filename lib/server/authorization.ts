import 'server-only';
import {getWorkspace} from './workspace';

export type Feature = 'accounting'|'tax'|'financial_reports'|'communications'|'campaigns'|'inventory'|'insights'|'growth'|'team';
export const featureRoles: Record<Feature, string[]> = {
 accounting:['owner','manager','finance'],tax:['owner','manager','finance'],financial_reports:['owner','manager','finance'],
 communications:['owner','manager','sales'],campaigns:['owner','manager'],inventory:['owner','manager','inventory'],
 insights:['owner','manager','finance'],growth:['owner','manager'],team:['owner']
};
export async function requireBusinessFeature(feature:Feature){
 const workspace=await getWorkspace();
 if(!featureRoles[feature].includes(workspace.role)) return {...workspace,allowed:false,reason:'Your staff role does not allow access.'};
 const {data,error}=await workspace.client.rpc('business_has_feature',{p_business_id:workspace.businessId,p_feature_key:feature});
 if(error) return {...workspace,allowed:false,reason:'Unable to verify your plan entitlement. Check migration 019.'};
 return {...workspace,allowed:data===true,reason:'This feature is not included in your approved plan. Ask your business owner to request an upgrade.'};
}
