import 'server-only';
import type {getWorkspace} from '@/lib/server/workspace';
import type {PaidFeature} from '@/lib/plan-catalog';
type Workspace=Awaited<ReturnType<typeof getWorkspace>>;
export type CoreModule='dashboard'|'customers'|'orders'|'payments'|'products'|'expenses'|'documents'|'settings';
export type CoreAction='view'|'create'|'edit'|'delete'|'approve'|'export';
/** Server-side safety layer: requires both module entitlement and per-action permission.
 * This does NOT replace RLS and transaction-local authorization in database RPCs.
 * Permission lookup failures always deny operations.
 */
export async function coreActionAllowed(workspace:Workspace,module:CoreModule,action:CoreAction):Promise<boolean>{
 const [moduleAccess,actionAccess]=await Promise.all([
  workspace.client.rpc('business_plan_core_feature_allowed',{p_business:workspace.businessId,p_feature:module}),
  workspace.client.rpc('business_can_perform_action',{p_business_id:workspace.businessId,p_module:module,p_action:action})
 ]);
 return !moduleAccess.error&&!actionAccess.error&&moduleAccess.data===true&&actionAccess.data===true;
}

/** Premium action check; requires active membership + module grant in PostgreSQL.
 * Legacy business/role guards are additional requirements. This guard cannot
 * protect a direct database RPC until the RPC itself invokes the same check.
 */
export async function premiumActionAllowed(workspace:Workspace,module:PaidFeature,action:CoreAction):Promise<boolean>{
 const {data,error}=await workspace.client.rpc('business_can_perform_action',{
  p_business_id:workspace.businessId,p_module:module,p_action:action
 });
 return !error&&data===true;
}
