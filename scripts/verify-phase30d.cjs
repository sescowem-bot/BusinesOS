const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sql=read('supabase/migrations/030_automation_execution.sql');
const worker=read('app/api/internal/automation-dispatch/route.ts');
const admin=read('app/admin/automations/page.tsx');
const owner=read('app/(dashboard)/automations/requests/page.tsx');
for(const guard of ['business_automation_rules','business_automation_runs','business_automation_email_jobs','business_automation_email_daily_budget',
 'admin_configure_automation_rule','admin_set_automation_rule_enabled','automation_process_due','automation_claim_email_jobs','automation_finish_email_job',
 'UNIQUE(rule_id,scheduled_for)','FOR UPDATE SKIP LOCKED','claim_token','notification_preferences','pg_advisory_xact_lock',
 "status text NOT NULL DEFAULT 'pending'",'service_role'])assert(sql.includes(guard),`Missing backend safety control: ${guard}`);
assert(sql.includes('enabled boolean NOT NULL DEFAULT false'),'Rules must default to disabled');
assert(sql.includes('claimed_count BETWEEN 0 AND 40'),'Email attempts need quota ceiling');
assert(sql.includes('v_remaining<=0'),'Worker must halt email claims after quota');
for(const guard of ['AUTOMATION_RUNNER_SECRET','ENABLE_AUTOMATION_RUNS','ENABLE_AUTOMATION_EMAIL_DELIVERY','ENABLE_PLATFORM_EMAIL_DELIVERY',
 'SUPABASE_SERVICE_ROLE_KEY','sendViaConfiguredResend','timingSafeEqual','automation_claim_email_jobs'])assert(worker.includes(guard),`Missing worker guard: ${guard}`);
assert(admin.includes('requirePlatformAdmin')&&admin.includes('AutomationRuleForm'),'Admin UI must be restricted');
assert(owner.includes(".eq('business_id',businessId)"),'Customer query must be tenant-scoped');
assert.deepStrictEqual(fs.readdirSync(root).filter(f=>f.endsWith('.md')),['README.md']);
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');let n=0;
for(const p of ['app/api/internal/automation-dispatch/route.ts','app/admin/automations/page.tsx','app/admin/automations/rule-form.tsx','app/admin/automations/actions.ts','app/(dashboard)/automations/requests/page.tsx','app/api/webhooks/resend/route.ts']){
 const f=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(f.parseDiagnostics.length,0,`TS syntax issue ${p}`);n++;
}
console.log(`Phase 030D security and scheduling checks passed (${n} TypeScript files)`);
