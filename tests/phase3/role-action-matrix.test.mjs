import {test} from 'node:test';import assert from 'node:assert/strict';
import {actionModules,roleActions,parseActionMatrix,matrixFromSaved,serializeMatrix,validPlanId,actionKey,safeMatrixForPlan,changedMatrixCells,validChangeReason} from '../../lib/role-action-catalog.ts';
test('Every module has all six actions',()=>{assert.equal(new Set(actionModules.map(m=>m.key)).size,actionModules.length);assert.deepEqual(roleActions,['view','create','edit','delete','approve','export'])});
test('Missing and duplicate rows rejected',()=>{const full=serializeMatrix(matrixFromSaved([],'sales'));assert.equal(parseActionMatrix(full,'sales')?.length,actionModules.length*6);assert.equal(parseActionMatrix(full.slice(1),'sales'),null);assert.equal(parseActionMatrix([...full.slice(1),full[1]],'sales'),null)});
test('Unexpected roles, keys and actions rejected',()=>{const full=serializeMatrix(matrixFromSaved([],'sales'));assert.equal(parseActionMatrix(full,'admin'),null);assert.equal(parseActionMatrix([{...full[0],module_key:'vault'},...full.slice(1)],'sales'),null);assert.equal(parseActionMatrix([{...full[0],action_key:'transfer'},...full.slice(1)],'sales'),null)});
test('Owner settings view is protected',()=>{const full=serializeMatrix(matrixFromSaved([],'owner'));full.find(x=>x.module_key==='settings'&&x.action_key==='view').decision='deny';assert.equal(parseActionMatrix(full,'owner'),null)});
test('Overrides default to existing access',()=>{const m=matrixFromSaved([],'staff');assert.equal(m[actionKey('customers','create')],'inherit');assert.equal(m[actionKey('orders','delete')],'inherit')});
test('Stored denial survives without widening grants',()=>{const m=matrixFromSaved([{module_key:'orders',action_key:'delete',decision:'deny',role:'sales'}],'sales');assert.equal(m[actionKey('orders','delete')],'deny');assert.equal(m[actionKey('orders','create')],'inherit')});
test('Plan ID injection rejected',()=>{for(const v of ['/admin','growth?role=owner','',null,'PRO'])assert.equal(validPlanId(v),false);assert.equal(validPlanId('professional'),true)});

test('Free cannot store a premium allow preference',()=>{
 const entries=serializeMatrix(matrixFromSaved([],'sales'));
 const pos=entries.find(x=>x.module_key==='pos'&&x.action_key==='create');pos.decision='allow';
 assert.equal(safeMatrixForPlan('free',entries),false);
 assert.equal(safeMatrixForPlan('starter',entries),true);
 pos.decision='deny';assert.equal(safeMatrixForPlan('free',entries),true);
});
test('Audit reason must be informative and bounded',()=>{
 assert.equal(validChangeReason('short'),false);
 assert.equal(validChangeReason('Quarterly access review for finance role'),true);
 assert.equal(validChangeReason('a'.repeat(301)),false);
});
test('Matrix comparison detects changed cells only',()=>{
 const original=matrixFromSaved([],'sales'),updated={...original,[actionKey('payments','export')]:'deny'};
 assert.equal(changedMatrixCells(original,updated),1);
 assert.equal(changedMatrixCells(original,original),0);
});
