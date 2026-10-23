#!/usr/bin/env node
/**
 * Run every existing regression suite, even when an earlier suite fails.
 * Never hide failures or skip the production build/typecheck CI jobs.
 * Runs only local scripts; no database mutation or deployment.
 */
'use strict';
const {spawnSync}=require('node:child_process');
const checks=[
  "check:phase21",
  "check:phase22",
  "check:phase23",
  "check:phase24",
  "check:website",
  "check:plans",
  "test:accounting",
  "check:admin-ui",
  "check:phase26",
  "check:branding-assets",
  "check:phase27",
  "check:phase28",
  "check:phase28b",
  "check:phase29",
  "check:phase30",
  "check:phase30b",
  "check:phase30c",
  "check:phase30d",
  "check:phase30e",
  "check:phase30f",
  "check:phase30g",
  "check:phase30h",
  "check:phase30i",
  "check:order-payment",
  "check:phase30j",
  "check:phase30k",
  "check:branch-stock",
  "check:phase30l",
  "check:auth-ux",
  "check:performance",
  "check:phase30m",
  "check:dashboard-support",
  "check:phase30n-ux",
  "check:free-pwa",
  "check:expenses-speed",
  "check:global-loading",
  "check:structured-plans",
  "check:dashboard-runtime-date",
  "check:ios-safe-errors",
  "check:customer-ux",
  "check:feature-visibility",
  "test:phase1",
  "test:phase2",
  "check:phase2-registers",
  "test:phase3"
];
const results=[];
for(const name of checks){
 process.stdout.write('\n========== '+name+' ==========\n');
 const start=Date.now();
 const run=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run',name],{
  stdio:'inherit',
  timeout:120000,
  env:process.env
 });
 const ok=run.status===0&&!run.error&&!run.signal;
 results.push({name,ok,ms:Date.now()-start,reason:run.error?.code||run.signal||run.status});
 console.log('[CI-regression]',ok?'PASS':'FAIL',name,'('+Math.round((Date.now()-start)/1000)+'s)');
}
console.log('\n=== COMPLETE REGRESSION SUMMARY ===');
for(const row of results)console.log((row.ok?'PASS':'FAIL')+' '+row.name+(row.ok?'':' [status='+String(row.reason)+']'));
const failed=results.filter(r=>!r.ok);
console.log(results.length+' checked; '+failed.length+' failed.');
if(failed.length)process.exitCode=1;
