#!/usr/bin/env node
// Offline source checks for pricing and actual public CMS card wiring; no network/db needed.
const fs=require('node:fs'); const assert=require('node:assert/strict');
const read=path=>fs.readFileSync(path,'utf8');let count=0;
function check(yes,name){assert.ok(yes,name);count++}
const plans=read('app/admin/plans/page.tsx'), price=read('app/admin/plans/price-actions.ts'),form=read('app/admin/plans/price-form.tsx');
const cms=read('app/admin/cms-form.tsx'),actions=read('app/admin/cms-actions.ts');
const content=read('lib/marketing-content.ts'), home=read('app/page.tsx'),shows=read('components/public-product-showcase.tsx'),publicCms=read('lib/server/public-cms.ts');
check(plans.includes('<PlanPriceForm')&&plans.includes('Subscription prices'),'Plan pricing must be above collapsed descriptions');
check(plans.indexOf('Subscription prices')<plans.indexOf('plan-card-directory'),'Monthly/annual price controls hidden below cards');
check(form.includes('name="monthly"')&&form.includes('name="annual"')&&form.includes('Save prices'),'Price inputs must be visible');
check(price.includes(".update({price_monthly_ngn")&&price.includes(".eq('id',id)"),'Dedicated price update must be scoped to chosen plan');
check(!price.includes('service_role'),'Price updates must use authenticated System Owner permissions');
check(price.includes('price_monthly_ngn')&&price.includes('price_yearly_ngn'),'Both billing intervals supported');
check(actions.includes(".update(base).eq('id',parsed.data.id)"),'CMS marketing update must not overwrite prices');
check(cms.includes('editableMarketingCards')&&cms.includes('Visible card title')&&cms.includes('Visible description'),'Actual published marketing cards need CMS editors');
check(cms.includes('Preview · before publishing'),'CMS preview missing');
check(actions.includes('editableMarketingCards(parsed.data.slug)'),'Block key allowlist missing in server validation');
check(publicCms.includes('key?:string'),'Page content retrieval must preserve keyed content');
for(const k of ['home.ability.0','home.daily.0','features.core.0','features.advanced.0','solutions.case.0','how.steps.0']) check(content.includes(k),`Missing editable CMS block ${k}`);
check(home.includes('marketingText(home?.sections'),'Homepage card titles must use saved CMS overrides');
check(shows.includes('marketingText(sections,`features.core.'),'Features must use saved CMS overrides');
check(shows.includes('marketingText(sections,`solutions.case.'),'Solutions must use saved CMS overrides');
check(shows.includes('marketingText(sections,`how.steps.'),'How It Works must use saved CMS overrides');
check(read('app/admin/plans/parent-actions.ts').includes('if(parent===original)'), 'Unchanged inheritance should not call RPC');
console.log(`Admin plan / public CMS wiring checks passed: ${count}`);
