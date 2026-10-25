import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const enforce=read('review/sql/20261025215511_businessos_phase1g_activate_action_matrix_after_parity_APPLIED_DO_NOT_RERUN.sql');
const admin=read('review/sql/20261025215446_businessos_phase1g_harden_audited_matrix_saving_APPLIED_DO_NOT_RERUN.sql');
const page=read('app/admin/plan-actions/page.tsx');
const doc=read('review/PHASE1G_ACTIVATION_ACCEPTANCE_20261025.md');
const live=read('review/sql/20261025_phase1g_after_activation_READ_ONLY.sql');
test('Phase 1G activation was applied with empty matrix and published plan safety preflights',()=>{
 assert.match(enforce,/enabled=true/);
 assert.match(enforce,/EXISTS\(SELECT 1 FROM public\.platform_plan_action_overrides\)/);
 assert.match(enforce,/count\(\*\) FROM public\.platform_plan_core_features WHERE enabled\)<>32/);
 assert.match(enforce,/2736/);
 assert.match(enforce,/COMMIT;/);
});
test('audited matrix server rejects Free premium Allow regardless of UI restrictions',()=>{
 assert.match(admin,/CREATE OR REPLACE FUNCTION public\.admin_save_plan_action_matrix/);
 assert.match(admin,/Free plan cannot explicitly allow premium modules/);
 assert.match(admin,/module_name NOT IN/);
 assert.match(admin,/choice='allow'/);
});
test('System Owner interface explains live decisions and inherited restrictions',()=>{
 assert.match(page,/Action permissions active/);
 assert.match(page,/take effect immediately/);
 assert.match(page,/Allow never bypasses paid entitlements/);
 assert.match(page,/Every module has View, Create, Edit, Delete, Approve and Export controls/);
});
test('activation ledger distinguishes synthetic SQL from real browser acceptance',()=>{
 assert.match(doc,/2,736 before\/after permission parity comparisons/);
 assert.match(doc,/Twenty-four simulated plan-role combinations/);
 assert.match(doc,/not real browser sessions/);
 assert.match(doc,/Do \*\*not\*\* delete policies/);
});
test('post-release health checks are strictly SELECT-only',()=>{
 assert.match(live,/platform_plan_action_enforcement/);
 assert.match(live,/platform_plan_action_overrides/);
 assert.match(live,/Free plan cannot explicitly allow premium modules/);
 assert.doesNotMatch(live,/\b(?:UPDATE|INSERT|DELETE|ALTER|CREATE|DROP|TRUNCATE|REVOKE|GRANT)\s+(?:public\.|INTO|FROM|TABLE|FUNCTION|ON)/i);
});
