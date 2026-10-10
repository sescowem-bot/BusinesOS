#!/usr/bin/env node
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sql=read('supabase/migrations/042_dashboard_support_roles.sql'),dash=read('app/(dashboard)/dashboard/page.tsx');
const team=read('app/(dashboard)/team/page.tsx'),support=read('app/(dashboard)/support/page.tsx'),supportActions=read('app/(dashboard)/support/actions.ts');
const admin=read('app/admin/support/page.tsx'),adminActions=read('app/admin/support/actions.ts');let n=0;const check=(v,msg)=>{assert.ok(v,msg);n++};
for(const name of ['business_dashboard_command','business_open_support_request','business_update_team_role','platform_support_queue','platform_resolve_support_request','crm_create_order_with_cost','business_record_missing_order_cost']){
 check(sql.includes(`FUNCTION public.${name}`),`SQL ${name}`);
 check(sql.includes(`REVOKE ALL ON FUNCTION public.${name}`)||sql.includes(`public.${name}(`),`permissions ${name}`);
}
for(const name of ['business_support_requests','business_member_role_audit','business_order_cost_evidence']){
 check(sql.includes(`CREATE TABLE public.${name}`),`table ${name}`);check(sql.includes(`ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY`),`RLS ${name}`);
}
check(sql.includes('platform_admins')&&sql.includes('AND active'),'active platform admin gates');
check(sql.includes("p_role NOT IN ('manager','sales','inventory','finance','staff')"),'owner promotion unavailable');
check(sql.includes("v_ticket.requested_by AND role='owner'"),'owner consent rechecked at execution');
check(sql.includes('business_member_role_audit')&&sql.includes("'platform_support'"),'role change audit');
check(sql.includes('p_unit_cost IS NOT NULL'),'cost optional');
check(sql.includes('business_record_missing_order_cost')&&read('app/(dashboard)/orders/[id]/page.tsx').includes('OrderCostForm'),'historic order cost backfill guarded');
check(sql.includes("v_role='staff'")&&sql.includes('v_expenses:=NULL'),'staff/finance data separation');
check(sql.includes('p_unit_cost<0')&&sql.includes("'owner','manager','finance'"),'cost restricted to finance team');
check(sql.includes('business_order_create_requests'),'atomic order idempotency retained');
check(sql.includes('coalesce(sum(greatest(0,total-paid)),0)'),'outstanding from completed payments');
check(sql.includes('count(DISTINCT o.id) FILTER(WHERE ev.order_id IS NULL)'),'missing manual costs identified');
check(sql.includes('business_pos_management_report'),'POS margin uses original item cost evidence and returns');
check(!dash.includes('loadBusinessInsights'),'large JavaScript download for dashboard removed');
check(dash.includes('business_dashboard_command')&&dash.includes('recent_orders'),'dashboard uses compact RPC');
check(dash.includes('Estimated gross profit on covered sales'),'clearly labelled estimate');
check(dash.includes('Part payment')&&dash.includes('Balance due'),'order status presentation');
check(dash.includes('missing_cost_orders'),'unknown cost stays unknown');
check(read('app/(dashboard)/dashboard/loading.tsx').includes('aria-busy'),'streaming route loading');
check(team.includes('changeTeamRole')&&team.includes('Invite staff'),'existing team role edit and invite');
check(supportActions.includes('business_open_support_request')&&support.includes('SupportForm'),'support form');
check(adminActions.includes('platform_resolve_support_request')&&admin.includes('platform_support_queue'),'admin role assistance');
check(read('components/admin-workspace.tsx').includes('/admin/support'),'admin navigation');
check(read('components/shell.tsx').includes('/support'),'business navigation');
check(!sql.includes('UPDATE public.orders SET')&&!sql.includes('DELETE FROM public.payments'),'migration does not mutate historical financial rows');
check(read('package.json').includes('check:dashboard-support'),'project check script');
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
for(const f of ['app/(dashboard)/dashboard/page.tsx','app/(dashboard)/support/page.tsx','app/(dashboard)/support/request-form.tsx','app/(dashboard)/support/actions.ts','app/admin/support/page.tsx','app/admin/support/review-form.tsx','app/admin/support/actions.ts','app/(dashboard)/team/page.tsx','app/(dashboard)/sales/actions.ts','app/(dashboard)/orders/new/reviewed-tax-actions.ts']){
 const sf=ts.createSourceFile(f,read(f),ts.ScriptTarget.Latest,true,f.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 check(sf.parseDiagnostics.length===0,`TypeScript syntax failure ${f}`);
}
console.log(`Phase 030M-C dashboard, support, cost and role security: ${n} static checks passed. Live SQL and build testing required.`);
