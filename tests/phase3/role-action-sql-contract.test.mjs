import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const sql=readFileSync('review/sql/phase3_plan_action_permissions_STAGING_ONLY.sql','utf8');
test('Schema is review-only, not a production migration',()=>assert.match(sql,/STAGING REVIEW ONLY/));
test('Every preference is scoped to plan role module and action',()=>assert.match(sql,/PRIMARY KEY\(plan_id,module_key,role,action_key\)/));
test('Admin-only audited write path',()=>{assert.match(sql,/platform_admins/);assert.match(sql,/platform_plan_action_audit/);assert.match(sql,/REVOKE ALL ON FUNCTION public.admin_save_plan_action_matrix/);assert.match(sql,/p_reason text/);assert.match(sql,/reason text NOT NULL CHECK/)});
test('No public write grants to the matrix',()=>assert.doesNotMatch(sql,/GRANT (INSERT|UPDATE|DELETE|ALL) ON public.platform_plan_action_overrides TO authenticated/));
test('Required RLS protections',()=>{assert.match(sql,/ALTER TABLE public.platform_plan_action_overrides ENABLE ROW LEVEL SECURITY/);assert.match(sql,/CREATE POLICY platform_owner_read_action_overrides/)});
test('SQL requires complete matrix and rejects duplicate keys',()=>{assert.match(sql,/jsonb_array_length\(p_entries\)<>114/);assert.match(sql,/Duplicate action setting/)});

test('Staging SQL rejects premium actions for Free',()=>assert.match(sql,/Free may not grant premium module actions/));
test('Mandatory audit reason and new signature',()=>{assert.match(sql,/btrim\(p_reason\)/);assert.match(sql,/text,text,jsonb,text\)/)});

test('An unchanged permission preference does not cause silent timestamp writes',()=>assert.match(sql,/WHERE platform_plan_action_overrides\.decision IS DISTINCT FROM excluded\.decision/));
