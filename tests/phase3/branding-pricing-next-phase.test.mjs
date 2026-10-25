import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=p=>readFileSync(p,'utf8');
test('favicon uses current public platform brand across browser, iOS and install manifest',()=>{
 const root=get('app/layout.tsx'),manifest=get('app/manifest.ts'),icon=get('app/api/branding/icon/[size]/route.tsx');
 assert.match(root,/browserBrandIcon\(b\)/);
 assert.match(root,/brandIconPath\(b,180\)/);
 assert.match(manifest,/brandIconPath\(b,192\)/);
 assert.match(manifest,/brandIconPath\(b,512,true\)/);
 assert.match(icon,/getPlatformBrand\(\)/);
 assert.match(icon,/getBrandImage\(brand\.favicon_url\)/);
 assert.match(icon,/getBrandImage\(brand\.logo_url\)/);
 assert.match(icon,/brand\.name\.trim\(\)\[0\]/);
 assert.doesNotMatch(get('public/favicon.svg'),/>B</);
});
test('favicon source is constrained to the public brand asset bucket',()=>{
 const code=get('app/api/branding/icon/[size]/route.tsx');
 assert.match(code,/trusted\.origin/);
 assert.match(code,/platform-brand-assets/);
 assert.match(code,/1572864/);
 assert.match(code,/AbortSignal\.timeout/);
 assert.match(get('app/admin/branding-assets.tsx'),/brandIconPath\(brand,64\)/);
});
test('pricing explorer is interactive, grounded, and read only',()=>{
 const app=get('components/public-plan-navigator.tsx'),page=get('app/pricing/page.tsx');
 assert.match(app,/useState/);
 assert.match(app,/aria-pressed/);
 assert.match(app,/byPlan\[p\.id\]/);
 assert.match(app,/available/);
 assert.match(app,/Show differences only/);
 assert.match(page,/PublicPlanNavigator/);
 assert.match(page,/PublicPlanComparisonControls/);
 assert.match(page,/planStartUrl\(plan\.id,access\)/);
 assert.doesNotMatch(app,/upgrade\?|checkout|paystack/i);
});
