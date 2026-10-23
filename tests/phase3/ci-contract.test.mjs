import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const require=createRequire(import.meta.url);
const {ciRuns}=require('../../scripts/ci-contract.cjs');
const checks=require('../../scripts/regression-checks.json');
test('all configured suites are executed from GitHub CI',()=>{
 for(const task of checks)assert.ok(ciRuns(task),'Suite is not scheduled: '+task);
});
test('TypeScript and production build run in CI',()=>{
 assert.ok(ciRuns('typecheck'));assert.ok(ciRuns('build'));
});
test('CI does not claim unregistered tasks',()=>{
 assert.equal(ciRuns('definitely-not-registered'),false);
 assert.equal(new Set(checks).size,checks.length);
});
