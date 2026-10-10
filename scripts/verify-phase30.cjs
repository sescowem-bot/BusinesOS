/** Verify Phase 030 release invariants without claiming integration testing. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const checks=[
 ['app/admin/pilot/page.tsx','requirePlatformAdmin()','Pilot checklist is server gated'],
 ['app/admin/pilot/actions.ts','requirePlatformAdmin()','Pilot writes check active administrator'],
 ['app/admin/pilot/actions.ts','pilotCheckIds.has(testId)','Pilot updates use known test keys'],
 ['app/admin/pilot/page.tsx','records.error','Pilot page must handle a missing migration'],
 ['app/admin/pilot/page.tsx','criticalMissing','Pilot display must show outstanding blockers'],
 ['supabase/migrations/028_pilot_acceptance_register.sql','ENABLE ROW LEVEL SECURITY','Pilot results must be protected'],
 ['supabase/migrations/028_pilot_acceptance_register.sql','auth.uid()','Pilot writes must verify caller identity'],
 ['supabase/migrations/028_pilot_acceptance_register.sql','CREATE TABLE IF NOT EXISTS public.platform_pilot_audit','Pilot changes must have audit history'],
 ['supabase/migrations/028_pilot_acceptance_register.sql','REVOKE ALL','Pilot tables must deny direct writes'],
 ['supabase/migrations/028_pilot_acceptance_register.sql','GRANT EXECUTE ON FUNCTION','Only authenticated callers may use RPC'],
 ['components/admin-workspace.tsx',"href:'/admin/pilot'",'Admin sidebar must expose Pilot Readiness'],
 ['app/admin/page.tsx',"href:'/admin/pilot'",'System Owner dashboard must link to pilot'],
 ['scripts/pilot-smoke.cjs',"redirect:'manual'",'Anonymous route test must not accidentally follow redirects'],
 ['scripts/pilot-smoke.cjs','https:', 'Public smoke test must require HTTPS'],
 ['.github/workflows/verify.yml','check:phase30','CI must run Phase 030 invariants']
];
for(const [file,text,explanation] of checks)assert(read(file).includes(text),explanation);
const pkg=JSON.parse(read('package.json'));
assert.equal(pkg.scripts['check:phase30'],'node scripts/verify-phase30.cjs');
assert.equal(pkg.scripts['smoke:pilot'],'node scripts/pilot-smoke.cjs');
const catalogue=read('lib/pilot-checklist.ts');
for(const id of ['AUTH-01','SEC-02','BIZ-03','INV-01','GL-01','RPT-02','MAIL-03','BUILD-01'])assert(catalogue.includes(id),`Missing pilot test ${id}`);
assert(!fs.readdirSync(root).some(x=>x.endsWith('.md')&&x!=='README.md'),'Only README.md is allowed at the repository root');
console.log(`Phase 030 checks PASS (${checks.length} security, navigation and release controls).`);
console.log('Pilot status is manually recorded, not automatically certified.');
