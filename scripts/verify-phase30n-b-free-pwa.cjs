// Source and schema contract validation for Phase 030N-B. Live DB tests required.
const assert=require('node:assert/strict');const fs=require('node:fs');
const rd=p=>fs.readFileSync(p,'utf8');let checks=0;
function expect(condition,label){assert.ok(condition,label);checks++}
const sql=rd('supabase/migrations/043_default_free_plan_pwa_onboarding.sql');
expect(sql.includes("VALUES ('free','Free','₦0'"),'Free plan is explicitly zero cost');
expect(sql.includes('ON CONFLICT (id) DO NOTHING'),'existing plan editorial data preserved');
expect(sql.includes('AFTER INSERT ON public.businesses'),'new business auto plan trigger');
expect(sql.includes('ON CONFLICT (business_id) DO NOTHING'),'never downgrade an assigned paid plan');
expect(sql.includes('FROM public.businesses b')&&sql.includes('WHERE NOT EXISTS'),'backfills only missing assignments');
expect(sql.includes("VALUES (NEW.id,'free',NULL,NULL,now())"),'new business default assignment');
expect(sql.includes('SECURITY DEFINER SET search_path=public,pg_temp'),'secure trigger context');
expect(sql.includes('REVOKE ALL ON FUNCTION public.assign_default_free_plan()'),'trigger function direct use revoked');
expect(sql.includes('BEGIN;')&&sql.includes('COMMIT;'),'atomic migration transaction');
const up=rd('app/(dashboard)/upgrade/page.tsx');
expect(up.includes("current==='free'")&&up.includes('Active at no cost'),'Free is clearly active on plan page');
expect(up.includes("plan.id==='free'?")&&up.includes('No request or payment needed'),'Free plan cannot be requested for approval');
expect(!up.includes('No approved plan assigned yet'),'confusing unassigned plan message removed');
expect(rd('app/onboarding/page.tsx').includes('Free plan and Owner'),'new owner onboarding promise');
expect(rd('app/onboarding/form.tsx').includes('Your Owner role'),'owner role documented');
const manifest=rd('app/manifest.ts');
for(const needle of ["start_url:'/dashboard'","display:'standalone'","scope:'/'","purpose:'maskable'","getPlatformBrand"])
 expect(manifest.includes(needle),`manifest: ${needle}`);
const layout=rd('app/layout.tsx');
expect(layout.includes("manifest:'/manifest.webmanifest'"),'manifest linked in metadata');
expect(layout.includes('appleWebApp:{capable:true'),'Apple web-app metadata');
expect(layout.includes("apple:'/app-icon-180.png'"),'Apple touch icon');
for(const [file,min,max] of [['app-icon-180.png',180,180],['app-icon-192.png',192,192],['app-icon-512.png',512,512],['app-icon-maskable-512.png',512,512]]){
 const bin=fs.readFileSync('public/'+file);
 expect(bin.slice(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),`${file} PNG signature`);
 expect(bin.readUInt32BE(16)===min&&bin.readUInt32BE(20)===max,`${file} dimensions`);
}
const install=rd('components/install-app-guide.tsx');
expect(install.includes('beforeinstallprompt'),'Chrome install event support');
expect(install.includes('appinstalled'),'installed state support');
expect(install.includes('Add to Home Screen')&&install.includes('Safari'),'iOS instructions');
expect(install.includes('WhatsApp')&&install.includes('in-app browser'),'WhatsApp link fallback');
expect(install.includes('matchMedia'),'standalone detection');
expect(!install.includes('serviceWorker.register'),'no unsafe offline caching of private financial screens');
expect(rd('components/shell.tsx').includes("href:'/install'"),'workspace install nav');
expect(rd('app/(dashboard)/dashboard/page.tsx').includes('href="/install"'),'dashboard quick install action');
expect(rd('components/public-footer.tsx').includes('href="/install"'),'public site install nav');
expect(rd('app/install/page.tsx').includes('InstallAppGuide'),'accessible guide route');
expect(rd('app/globals.css').includes('@media(max-width:760px){.install-page-layout'),'mobile layout');
expect(rd('.github/workflows/verify.yml').includes('npm run check:free-pwa'),'CI coverage');
let ts;try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js')}
for(const file of ['app/manifest.ts','app/install/page.tsx','components/install-app-guide.tsx','app/layout.tsx','app/(dashboard)/upgrade/page.tsx']){
 const sf=ts.createSourceFile(file,rd(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 expect(sf.parseDiagnostics.length===0,`TypeScript/TSX parser: ${file}`);
}
console.log(`Phase 030N-B default Free plan and PWA checks passed (${checks} assertions).`);
