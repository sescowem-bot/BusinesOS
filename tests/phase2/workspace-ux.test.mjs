import assert from 'node:assert/strict';
import {test} from 'node:test';
import {workspaceNavigationGroups,primaryWorkspacePaths,mobileWorkspacePaths,workspaceRoleCanSeeLink,nextWorkspaceSetupAction} from '../../lib/workspace-navigation.ts';
import {dashboardAccess,dashboardQuickActions,dashboardReportLinks,dashboardAttentionLinks} from '../../lib/dashboard-workflow.ts';
import {getRecordPage} from '../../lib/record-table-view.ts';
import {nameFieldMessage,amountFieldMessage} from '../../lib/form-experience.ts';
test('simple navigation contains no more than eight common links',()=>{
 for(const role of ['owner','manager','finance','sales','inventory','staff'])assert.ok(primaryWorkspacePaths(role).length<=8);
});
test('simple mode cannot display pages outside authorized groups',()=>{
 const groups=[{title:'Sales',items:[{href:'/dashboard'},{href:'/orders'}]}];
 assert.deepEqual(workspaceNavigationGroups(groups,{mode:'simple',search:'',pathname:'/dashboard',role:'sales'}).flatMap(g=>g.items).map(i=>i.href),['/dashboard','/orders']);
});
test('advanced and search preserve authorization-filtered items',()=>{
 const groups=[{title:'Tools',items:[{href:'/support'},{href:'/dashboard'}]}];
 assert.equal(workspaceNavigationGroups(groups,{mode:'advanced',search:'',pathname:'/',role:'staff'})[0].items.length,2);
 assert.equal(workspaceNavigationGroups(groups,{mode:'simple',search:'help',pathname:'/',role:'staff'})[0].items.length,2);
});
test('nested deep links remain visible in simple mode',()=>{
 const groups=[{title:'Tools',items:[{href:'/dashboard'},{href:'/inventory'}]}];
 const v=workspaceNavigationGroups(groups,{mode:'simple',search:'',pathname:'/inventory/transfers',role:'sales'});
 assert.ok(v.some(g=>g.title==='Current tool'&&g.items[0].href==='/inventory'));
});
test('mobile paths exclude finance actions for unprivileged staff',()=>{
 assert.deepEqual(mobileWorkspacePaths('staff',false),['/dashboard']);
 assert.ok(mobileWorkspacePaths('sales',false).includes('/orders'));
 assert.ok(mobileWorkspacePaths('owner',true).includes('/admin'));
});
test('role-specific advanced nav visibility',()=>{
 assert.equal(workspaceRoleCanSeeLink('staff','/pos'),false);
 assert.equal(workspaceRoleCanSeeLink('finance','/reports'),true);
});
test('setup next-action ignores unknown and completed steps',()=>{
 const steps=[{title:'Unknown',complete:null,canPerform:true},{title:'Done',complete:true,canPerform:true},{title:'Next',complete:false,canPerform:true}].map(s=>({...s,href:'/dashboard',action:'Open'}));
 assert.equal(nextWorkspaceSetupAction(steps)?.title,'Next');
});
test('dashboard permissions enforce role and plan flags',()=>{
 assert.equal(dashboardAccess('staff',['pos','financial_reports']).reports,false);
 assert.equal(dashboardAccess('sales',[]).pos,false);
 assert.equal(dashboardAccess('sales',['pos']).pos,true);
});
test('dashboard quick actions never expose unauthorized POS or reports',()=>{
 assert.ok(!dashboardQuickActions('staff',['pos','financial_reports']).some(x=>x.href==='/pos'||x.href==='/reports'));
 assert.equal(dashboardReportLinks('sales',['financial_reports']).length,0);
});
test('attention is shown only when it is actionable',()=>{
 assert.equal(dashboardAttentionLinks('staff',['inventory'],5,3).length,1);
 assert.equal(dashboardAttentionLinks('owner',['inventory'],5,3).length,3);
});
test('record table clamps pages after narrowing filters',()=>{
 const r=getRecordPage([{search:'one',filter:'paid'},{search:'two',filter:'unpaid'}],'one','all',99,1);
 assert.equal(r.page,1);assert.equal(r.shown.length,1);
});
test('form validation preserves cents and whitespace rules',()=>{
 assert.equal(nameFieldMessage(' ',2,20,'Business').valid,false);
 assert.equal(amountFieldMessage('0.07','Price').valid,true);
 assert.equal(amountFieldMessage('0.001','Price').valid,false);
});
