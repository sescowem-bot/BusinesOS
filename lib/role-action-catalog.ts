import {essentialCapabilities,paidCapabilities,planRoles} from './plan-catalog.ts';
/** Three-state, non-elevating overrides. The existing database authorisation
 * continues to apply even when an action is marked "allow". */
export const roleActions=['view','create','edit','delete','approve','export'] as const;
export type RoleAction=typeof roleActions[number];
export const actionDecisions=['inherit','allow','deny'] as const;
export type ActionDecision=typeof actionDecisions[number];
export const actionModules=[...essentialCapabilities,...paidCapabilities] as const;
export type ActionModule=typeof actionModules[number]['key'];
export type ActionRole=typeof planRoles[number]['key'];
export type PermissionEntry={module_key:ActionModule;action_key:RoleAction;decision:ActionDecision};
export type StoredDecision={module_key:string;action_key:string;role:string;decision:string};
export const essentialModuleKeys=new Set<string>(essentialCapabilities.map(c=>c.key));
export const actionKey=(module:string,action:string)=>module+':'+action;
export function validPlanId(input:unknown):input is string{
 return typeof input==='string'&&/^[a-z][a-z0-9_-]{0,69}$/.test(input);
}
export const validRole=(input:unknown):input is ActionRole=>typeof input==='string'&&planRoles.some(r=>r.key===input);
export const validModule=(input:unknown):input is ActionModule=>typeof input==='string'&&actionModules.some(m=>m.key===input);
export const validAction=(input:unknown):input is RoleAction=>typeof input==='string'&&roleActions.some(a=>a===input);
export const validDecision=(input:unknown):input is ActionDecision=>typeof input==='string'&&actionDecisions.some(d=>d===input);
export function parseActionMatrix(data:unknown,role:unknown):PermissionEntry[]|null{
 if(!validRole(role)||!Array.isArray(data)||data.length!==actionModules.length*roleActions.length)return null;
 const seen=new Set<string>();const parsed:PermissionEntry[]=[];
 for(const row of data){
  if(!row||typeof row!=='object'||Array.isArray(row))return null;
  const {module_key,action_key,decision}=row as Record<string,unknown>;
  if(!validModule(module_key)||!validAction(action_key)||!validDecision(decision))return null;
  if(role==='owner'&&module_key==='settings'&&action_key==='view'&&decision==='deny')return null;
  const key=actionKey(module_key,action_key);if(seen.has(key))return null;seen.add(key);
  parsed.push({module_key,action_key,decision});
 }
 return parsed;
}
/** A staged preference must never widen Free beyond the core workspace. */
export function safeMatrixForPlan(plan:string,entries:readonly PermissionEntry[]):boolean{
 if(!validPlanId(plan))return false;
 return plan!=='free'||entries.every(row=>essentialModuleKeys.has(row.module_key)||row.decision!=='allow');
}
/** Explain the exact number of changes before the administrator saves them. */
export function changedMatrixCells(before:Readonly<Record<string,ActionDecision>>,after:Readonly<Record<string,ActionDecision>>):number{
 return actionModules.reduce((count,mod)=>count+roleActions.filter(action=>before[actionKey(mod.key,action)]!==after[actionKey(mod.key,action)]).length,0);
}
export function validChangeReason(input:unknown):input is string{
 return typeof input==='string'&&input.trim().length>=12&&input.trim().length<=300;
}
export function matrixFromSaved(saved:readonly StoredDecision[],role:ActionRole):Record<string,ActionDecision>{
 const map:Record<string,ActionDecision>={};
 for(const mod of actionModules)for(const action of roleActions)map[actionKey(mod.key,action)]='inherit';
 for(const row of saved){
  if(row.role!==role||!validModule(row.module_key)||!validAction(row.action_key)||!validDecision(row.decision)||row.decision==='inherit')continue;
  map[actionKey(row.module_key,row.action_key)]=row.decision;
 }
 if(role==='owner')map[actionKey('settings','view')]='allow';
 return map;
}
export function serializeMatrix(map:Readonly<Record<string,ActionDecision>>):PermissionEntry[]{
 return actionModules.flatMap(mod=>roleActions.map(action=>({module_key:mod.key,action_key:action,decision:map[actionKey(mod.key,action)]||'inherit'})));
}
