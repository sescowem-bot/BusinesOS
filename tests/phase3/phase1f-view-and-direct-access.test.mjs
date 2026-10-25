import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const required=[["customers","customers"],["orders","orders"],["products","products"],["payments","payments"],["expenses","expenses"],["invoices","documents"],["settings","settings"],["receivables","payments"],["exports","documents"],["pos","pos"],["returns","pos"],["wholesale","pos"],["inventory","inventory"],["purchasing","purchasing"],["accounting","accounting"],["reports","financial_reports"],["retail-reports","financial_reports"],["tax-centre","tax"],["communications","communications"],["insights","insights"],["growth","growth"],["tasks","team"],["team/updates","team"],["tax-compliance","tax"]];
test('all listed core/premium route trees deny direct navigation when View permission is absent',()=>{
 for(const [route,module] of required){
  const src=read('app/(dashboard)/'+route+'/layout.tsx');
  assert.ok(src.includes("requireWorkspaceModuleView('"+module+"')"),route);
 }
});
test('workspace shell uses a single cached database module visibility decision',()=>{
 const w=read('lib/server/visible-modules.ts');
 const l=read('app/(dashboard)/layout.tsx');
 const sh=read('components/shell.tsx');
 assert.match(w,/import \{cache\} from 'react'/);
 assert.match(w,/rpc\('business_visible_modules'/);
 assert.match(w,/if\(error\|\|!Array\.isArray\(data\)\)/);
 assert.match(w,/redirect\('\/dashboard'\)/);
 assert.match(l,/getWorkspaceVisibleModules\(\)/);
 assert.doesNotMatch(l,/client\.rpc\('business_workspace_features'/);
 assert.match(sh,/enabledFeatures\.includes\(restrictedModules\[item\.href\]\)/);
 assert.match(sh,/mobileWorkspacePaths\(businessRole,isPlatformAdmin\)\.filter/);
 for(const [route,module] of [['customers','customers'],['orders','orders'],['products','products'],['expenses','expenses'],['settings','settings'],['payments','payments'],['invoices','documents'],['tasks','team']])
  assert.ok(sh.includes("'/"+route+"':'"+module+"'"),route);
});
test('optional paid feature checks respect View denial and still verify paid entitlement',()=>{
 const file=read('lib/server/authorization.ts');
 assert.match(file,/rpc\('business_has_feature'/);
 assert.match(file,/getWorkspaceVisibleModules\(\)/);
 assert.match(file,/visibility\.modules\.includes\(feature\)/);
});
test('applied SQL protects module visibility endpoint and revokes unsafe table powers',()=>{
 const sql=read('review/sql/20261025213253_businessos_phase1f_one_query_workspace_visible_modules_APPLIED_DO_NOT_RERUN.sql');
 const rev=read('review/sql/20261025212905_businessos_phase1e_revoke_data_api_table_ddl_privileges_APPLIED_DO_NOT_RERUN.sql');
 const rls=read('review/sql/20261025213019_businessos_phase1e_remaining_rest_action_guards_APPLIED_DO_NOT_RERUN.sql');
 assert.match(sql,/business_visible_modules/);
 assert.match(sql,/business_membership_is_active/);
 assert.match(sql,/business_can_perform_action/);
 assert.match(sql,/FROM PUBLIC,anon/);
 assert.match(rev,/REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public/i);
 assert.match(rls,/businessos_phase1e_quote_items_create/);
 assert.match(rls,/businessos_phase1e_installment_schedule_delete/);
 assert.match(rls,/REVOKE DELETE ON public\.businesses/);
});
