/** Phase 029 offline release invariants. Does NOT replace browser/RLS penetration tests. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const exportRoute=read('app/api/reports/export/route.ts');
const setupRoute=read('app/api/setup-status/route.ts');
const checks=[
 [exportRoute.includes('financialContext()'),'Reports must verify tenant and approved feature'],
 [(exportRoute.match(/count:'exact'/g)||[]).length===5,'Every report dataset needs an exact record count'],
 [exportRoute.includes('requireComplete(result')&&exportRoute.includes('requireComplete(jResult')&&exportRoute.includes('requireComplete(lResult')&&exportRoute.includes('requireComplete(aResult'),'Report CSVs must reject truncated result sets'],
 [exportRoute.includes('line=>!jm.has(line.journal_id)'),'Ledger must not silently omit orphaned lines'],
 [exportRoute.includes('status:409'),'Incomplete CSV must fail with explicit error'],
 [exportRoute.includes('Cache-Control')&&exportRoute.includes('private, no-store'),'Financial exports must not be publicly cached'],
 [setupRoute.includes('requirePlatformAdmin()'),'Infrastructure configuration diagnostic must be admin-only'],
 [!setupRoute.includes('SUPABASE_SERVICE_ROLE_KEY'),'Configuration diagnostic must not reference private secrets'],
 [read('tsconfig.json').includes('supabase/functions/**'),'Deno Edge Functions must not be typed as Next.js files'],
 [read('supabase/functions/send-email/index.ts').includes("new Webhook(hookSecret).verify"),'Auth email hook must verify signed requests'],
 [read('app/api/webhooks/resend/route.ts').includes('verifyResendSignature'),'Resend webhook must verify signed requests'],
 [read('app/(dashboard)/expenses/actions.ts').includes("['owner','manager','finance']"),'Expenses may only be recorded by authorised roles'],
 [read('lib/server/authorization.ts').includes("rpc('business_has_feature'"),'Premium features must be checked by database'],
 [read('lib/server/workspace.ts').includes(".eq('user_id',user.id).eq('business_id',requestedBusinessId)"),'Cookie-selected workspaces must verify membership']
];
for(const [ok,reason] of checks)assert(ok,reason);
const workflow=read('.github/workflows/verify.yml');
for(const task of ['check:phase21','check:phase22','check:phase23','check:phase24','check:website','check:plans','test:accounting','check:admin-ui','check:phase26','check:branding-assets','check:phase27','check:phase28','check:phase28b','check:phase29','typecheck','build'])assert(workflow.includes(task),`CI missing ${task}`);
assert(workflow.includes('deno check supabase/functions/send-email/index.ts'),'Auth email hook must be checked in its own runtime');
const docs=fs.readdirSync(root).filter(f=>f.endsWith('.md')&&f!=='README.md');
assert.equal(docs.length,0,'README must be the only root Markdown file');
const config=JSON.parse(read('package.json'));
assert.equal(config.scripts['check:phase29'],'node scripts/verify-phase29.cjs');
console.log('Phase 029 release source checks: PASS ('+checks.length+' controls + CI/documentation checks).');
console.log('Live database access, tenant/RLS tests, Auth Hook delivery and Vercel build remain separate required checks.');
