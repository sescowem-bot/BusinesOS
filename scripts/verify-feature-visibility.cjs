#!/usr/bin/env node
// Focused entitlement-visibility regression guard.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const read=(p)=>fs.readFileSync(p,'utf8');
const auth=read('lib/server/authorization.ts');
const menu=read('components/shell.tsx');
const report=read('app/(dashboard)/retail-reports/page.tsx');
const general=read('app/(dashboard)/reports/page.tsx');
const acct=read('app/(dashboard)/accounting/page.tsx');
const purchasing=read('app/(dashboard)/purchasing/page.tsx');
assert.match(auth,/if\(!allowed&&!options\.optional\)redirect\('\/dashboard'\)/,'Denied module URLs must redirect without upsell or error');
assert.match(auth,/if\(!options\.optional\)redirect\('\/dashboard'\)/,'Permission-check failures must fail closed');
assert.match(menu,/enabledFeatures\.includes\(restrictedModules\[item\.href\]\)/,'Navigation must filter by server-calculated entitlements');
assert.match(menu,/roleRestrictedModules\[item\.href\]\.includes\(businessRole\|\|''\)/,'Management-only menu must filter by role');
for(const p of ['/retail-reports','/reports','/accounting']){
 assert.ok(menu.includes("'"+p+"':['owner','manager','finance']"),'Missing role mapping '+p);
}
assert.match(report,/if\(!\['owner','manager','finance'\]\.includes\(role\)\)redirect\('\/dashboard'\)/,'Retail route must not expose unavailable reports');
assert.match(general,/if\(!\['owner','manager','finance'\]\.includes\(check\.role\)\)redirect\('\/dashboard'\)/,'Financial reports require authorised role');
assert.match(acct,/if\(!\['owner','manager','finance'\]\.includes\(role\)\)redirect\('\/dashboard'\)/,'Accounting requires authorised role');
assert.match(purchasing,/requireBusinessFeature\('inventory',\{optional:true\}\)/,'Optional inventory must not hide purchasing');
assert.match(general,/\{showTax&&<p>/,'Tax shortcut is entitlement-aware');
assert.match(acct,/\{showReports&&<p>/,'Reports shortcut is entitlement-aware');
console.log('BusinessOS feature visibility: static source checks passed.');
