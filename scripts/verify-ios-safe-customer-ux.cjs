#!/usr/bin/env node
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const ts=require('./load-typescript.cjs')
const read=p=>fs.readFileSync(p,'utf8');let count=0;
function check(yes,message){assert.ok(yes,message);count++}
const install=read('components/install-app-guide.tsx');
for(const text of ["useState<Device>('ios')",'detectDevice()',"navigator.platform==='MacIntel'",'navigator.maxTouchPoints>1',"setDevice('ios')","setDevice('android')","setDevice('desktop')",'aria-pressed','Safari','Chrome','Add to Home Screen','WhatsApp','beforeinstallprompt','matchMedia'])check(install.includes(text),'missing accessible install feature '+text);
check(read('app/layout.tsx').includes('appleWebApp:{capable:true'),'iOS standalone metadata not configured');
check(read('app/manifest.ts').includes("display:'standalone'"),'standalone PWA manifest missing');
check(read('app/globals.css').includes('install-device-picker'),'touch device switcher styling missing');
const feedback=read('lib/user-feedback.ts');
check(feedback.includes('friendlyServiceError'),'centralized safe public error translator missing');
check(!feedback.includes('return error.message'),'raw database exception could be returned');
// Execute the pure mapper using transpiled CommonJS to prove hostile database messages are never returned.
const vm=require('node:vm');const transpiled=ts.transpileModule(feedback,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleShim={exports:{}};vm.runInNewContext(transpiled,{module:moduleShim,exports:moduleShim.exports});
const customerError=moduleShim.exports.friendlyServiceError;
for(const sample of [
 {code:'42P01',message:'relation public.private_customer_balances does not exist'},
 {code:'PGRST202',message:'could not find function financials(secret_key)'},
 {code:'23505',message:'duplicate key value violates unique constraint business_users_email_key'},
 {code:'42501',message:'permission denied for table auth.users'},
 {code:'57014',message:'statement timeout: SELECT * FROM confidential_records'}
]){
 const visible=customerError('save this record',sample);
 check(!/public\.|auth\.|42P01|PGRST|secret_key|business_users_email_key|confidential_records|statement timeout|SQL|migration/i.test(visible),'raw details visible for '+sample.code);
 check(visible.length>25&&visible.length<220,'user-facing message is useful and concise');
}

const files=[];const recurse=dir=>{for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())recurse(p);else if(/\.(tsx|ts)$/.test(ent.name))files.push(p)}};
recurse('app');recurse('components');
for(const f of files){const code=read(f);
 const source=ts.createSourceFile(f,code,ts.ScriptTarget.Latest,true,f.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 check(source.parseDiagnostics.length===0,'TS/TSX parse failed: '+f);
 if(!f.includes('app/admin/')&&(f.endsWith('/page.tsx')||f.endsWith('/error.tsx'))){
  // End users should never be told migration identifiers while attempting a normal workflow.
  check(!/(?:apply|confirm|verify|check|install|requires?)\s+(?:an?\s+)?(?:sql\s*)?(?:database\s+)?migrations?\s*\d+/i.test(code),'technical migration advice in UI: '+f);
 }
 if(f.endsWith('actions.ts')||f.endsWith('-actions.ts')){
  check(!/return\s+\{[^\n]*?(?:error|message):\s*error\.message\b/.test(code),'direct raw database error in action: '+f);
  check(!/\$\{error\.message\}/.test(code),'interpolated raw database error in action: '+f);
 }
}
check(read('app/error.tsx').includes('Try again'),'generic app error boundary missing');
check(read('app/global-error.tsx').includes('Try again'),'global error boundary missing');
check(!read('app/(dashboard)/dashboard/page.tsx').includes('should verify that SQL migrations'),'dashboard still displays SQL fix to customers');
check(!read('app/admin/asset-actions.ts').includes('uploadError.message'),'branding upload exposed provider errors');
check(!read('app/admin/email/actions.ts').includes('queueError?.message'),'email test exposed internal error');
console.log(`iOS guide and customer-safe error checks passed: ${count} assertions over ${files.length} app/component TypeScript files.`);
