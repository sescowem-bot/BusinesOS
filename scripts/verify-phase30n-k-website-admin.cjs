const fs=require('fs');const assert=require('node:assert/strict');const ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');let n=0;
const has=(f,v)=>{assert.match(read(f),v);n++};
const lacks=(f,v)=>{assert.doesNotMatch(read(f),v);n++};
for(const path of ['app/admin/branding/page.tsx','app/admin/content/[slug]/page.tsx','components/public-contact-dock.tsx','lib/public-contact.ts']){assert.ok(fs.existsSync(path));n++}
has('components/admin-workspace.tsx',/\/admin\/branding/);
has('app/admin/website/page.tsx',/Website management/);
has('app/admin/website/page.tsx',/Page editor/);
has('app/admin/website/page.tsx',/Brand Studio/);
lacks('app/admin/website/page.tsx',/<BrandingAssets/);
lacks('app/admin/website/page.tsx',/<BrandingForm/);
has('app/admin/branding/page.tsx',/<BrandingAssets brand=/);
has('app/admin/branding/page.tsx',/<BrandingForm brand=/);
has('app/admin/branding/page.tsx',/requirePlatformAdmin/);
has('app/admin/content/page.tsx',/\/admin\/content\/\$\{page\.slug\}/);
has('app/admin/content/[slug]/page.tsx',/requirePlatformAdmin/);
has('app/admin/content/[slug]/page.tsx',/defaultPages\.find/);
has('app/admin/content/[slug]/page.tsx',/<PageEditor/);
lacks('app/admin/content/page.tsx',/PlanEditor/);
has('app/page.tsx',/FROM A SALE TO A CLEAR BALANCE/);
has('app/page.tsx',/Talk to us/);
has('components/public-footer.tsx',/PublicContactDock/);
has('components/public-contact-dock.tsx',/Chat with our team on WhatsApp/);
has('app/(public)/[slug]/page.tsx',/whatsappUrl/);
has('app/admin/branding-form.tsx',/WhatsApp and support mobile number/);
has('lib/public-contact.ts',/encodeURIComponent/);
lacks('app/admin/cms-actions.ts',/JSON array of/);
// Run pure contact-link formatter using the TypeScript compiler included in the development environment.
const js=ts.transpileModule(read('lib/public-contact.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const sandbox={module:{exports:{}},exports:null};sandbox.exports=sandbox.module.exports;
require('vm').runInNewContext(js,sandbox);const {whatsappUrl,phoneUrl}=sandbox.module.exports;
assert.ok(whatsappUrl('+234 801 234 5678').startsWith('https://wa.me/2348012345678?text='));n++;
assert.ok(whatsappUrl('08012345678').includes('wa.me/2348012345678'));n++;
for(const invalid of ['', 'javascript:alert(1)','not_configured','+234']){assert.equal(whatsappUrl(invalid),null);n++}
assert.equal(phoneUrl('unknown'),null);n++;
assert.equal(phoneUrl('+234 801 234 5678'),'tel:+2348012345678');n++;
console.log(`Phase 030N-K website CMS, branding and contact: ${n} assertions passed.`);
