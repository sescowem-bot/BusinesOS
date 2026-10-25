import 'server-only';
import {cache} from 'react';
import {redirect} from 'next/navigation';
import type {ActionModule} from '@/lib/role-action-catalog';
import {getWorkspace} from '@/lib/server/workspace';

/** One request-local, authenticated database decision for the 19 module View
 * rules. The SQL function checks tenant membership, the plan and action matrix.
 * Errors fail closed and no separate network request is made for nested layouts.
 */
export const getWorkspaceVisibleModules=cache(async():Promise<{modules:readonly string[];error:boolean}>=>{
 const workspace=await getWorkspace();
 const {data,error}=await workspace.client.rpc('business_visible_modules',{p_business:workspace.businessId});
 if(error||!Array.isArray(data))return {modules:[],error:true};
 return {modules:data.filter((x):x is string=>typeof x==='string'),error:false};
});

export async function requireWorkspaceModuleView(module:ActionModule):Promise<void>{
 const {modules,error}=await getWorkspaceVisibleModules();
 if(error||!modules.includes(module))redirect('/dashboard');
}
