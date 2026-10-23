#!/usr/bin/env node
/**
 * Run every existing regression suite, even when an earlier suite fails.
 * Never hide failures or skip the production build/typecheck CI jobs.
 * Runs only local scripts; no database mutation or deployment.
 */
'use strict';
const {spawnSync}=require('node:child_process');
const checks=require('./regression-checks.json')
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
