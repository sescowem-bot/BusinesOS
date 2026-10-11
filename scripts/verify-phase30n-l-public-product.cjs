/** Public marketing quality gate: distinguishes product pages and guards honest plan content. */
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');let checks=0;
const has=(file,pattern)=>{assert.match(read(file),pattern,`${file} missing ${pattern}`);checks++};
const lacks=(file,pattern)=>{assert.doesNotMatch(read(file),pattern,`${file} leaked ${pattern}`);checks++};
const page='app/page.tsx',inside='app/(public)/[slug]/page.tsx',show='components/public-product-showcase.tsx',pricing='app/pricing/page.tsx';
for(const section of ['WHAT THE PLATFORM HELPS YOU DO','FROM A SALE TO A CLEAR BALANCE','SOLUTIONS FOR HOW YOU WORK','PLANS THAT FIT YOUR BUSINESS'])has(page,new RegExp(section));
for(const module of ['Know every customer','Follow every sale','Send cleaner invoices','Manage stock & buying','See business activity'])has(page,new RegExp(module));
for(const name of ['FeatureShowcase','SolutionShowcase','HowShowcase','AboutShowcase','ResourcesShowcase','ContactShowcase']){has(show,new RegExp(`export function ${name}`));has(inside,new RegExp(`<${name} `));}
for(const name of ['Retail stores','Wholesalers and distributors','Professional services','Growing teams'])has(show,new RegExp(name));
for(const action of ['Create your business workspace','Add your customers and catalogue','Record a sale and its payment','Issue documents and record expenses'])has(show,new RegExp(action));
for(const topic of ['Orders and part payments','Invoices and documents','Retail point of sale','Suppliers and purchasing','Financial reporting'])has(show,new RegExp(topic));
for(const element of ['getPublishedPlans','getPublishedPlanCapabilities','price_monthly_ngn','price_yearly_ngn','essentialCapabilities','releasedPaidCapabilities','mp-compare-table','mp-faq-list'])has(pricing,new RegExp(element));
has(page,/getPublicPage\('home'\)/);has(page,/home\?\.sections/);has(inside,/page\.sections/);
has(page,/brandName=\{brand\.name\}/);has('components/public-workspace-preview.tsx',/brandName/);
has('lib/server/public-cms.ts',/stockTitles/);has('lib/server/public-cms.ts',/stockDescriptions/);
has('lib/server/public-cms.ts',/if\(!data\.published\)return legal\?draft:null/);
has('app/admin/content/[slug]/page.tsx',/PageEditor/);
for(const file of [page,inside,pricing,show])lacks(file,/©\s?20[0-9]{2} Example Enterprises/);
lacks(pricing,/planPaths/);lacks(pricing,/\b(?:₦25,000|₦50,000|₦100,000)\b/);
const css=read('app/globals.css');for(const cls of ['mp-case-grid','mp-pricing-cards','mp-module-grid','mp-timeline','mp-feature-grid','mp-journey-grid']){assert(css.includes(`.${cls}`));checks++}
assert.match(css,/@media\(max-width:520px\)/);checks++;
console.log(`Phase 030N-L premium public pages: ${checks} assertions passed`);
