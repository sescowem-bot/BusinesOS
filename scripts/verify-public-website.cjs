#!/usr/bin/env node
const fs=require('node:fs');const assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const dynamic=read('app/(public)/[slug]/page.tsx');
const cms=read('lib/server/public-cms.ts');
const footer=read('components/public-footer.tsx');
const nav=read('components/public-nav.tsx');
const home=read('app/page.tsx');
const styles=read('app/globals.css');
for(const name of ['privacy','terms','cookies']){
 assert(dynamic.includes(`'${name}'`),`Public route ${name} missing`);
 assert(cms.includes(`${name}:{slug:'${name}'`),`Missing fallback for ${name}`);
 assert(footer.includes(`href="/${name}"`),`Footer missing ${name}`);
}
assert(cms.includes('reviewRequired:true'),'Legal draft label should not be omitted');
assert(cms.includes('legacyBoilerplate'),'Original CMS marketing placeholder must be handled without overwriting custom data');
assert(nav.includes('access===\'admin\''),'Super Admin link check absent');
assert(home.includes('<PublicFooter'),'Homepage missing shared legal footer');
assert(home.includes('PublicWorkspacePreview'),'Hero preview missing');
assert(!home.includes('₦4.85m'),'Fictional hero sales numbers must not appear');
assert(styles.includes('prefers-reduced-motion:reduce'),'Reduced-motion support required');
assert(!dynamic.includes('if(!page)notFound();return'),'Ensure page fallback aware of legal status');
console.log('Website quality checks passed: legal fallback, links, role navigation, shared footer, preview, CMS protection and motion.');
