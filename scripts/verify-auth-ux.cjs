#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
let ts;try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js')}
const src=read('lib/auth-feedback.ts');
const result=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(result.diagnostics?.length,0);
const scope={exports:{}};vm.runInNewContext(result.outputText,scope);
const {explainAuthError,extractAuthRetrySeconds}=scope.exports;
assert.equal(extractAuthRetrySeconds('you can only request this after 36 seconds'),36);
assert.equal(extractAuthRetrySeconds('Retry in 2 minutes'),120);
assert.equal(extractAuthRetrySeconds('Please wait'),0);
assert.equal(explainAuthError({code:'over_email_send_rate_limit',message:'For security purposes, you can only request this after 36 seconds.'},'signup').retryAfterSeconds,36);
assert.equal(explainAuthError({status:429},'login').reason,'rate_limit');
assert.equal(explainAuthError({code:'email_not_confirmed'},'login').reason,'unconfirmed');
assert.equal(explainAuthError({code:'invalid_credentials'},'login').reason,'credentials');
assert.equal(explainAuthError({code:'email_address_not_authorized'},'signup').reason,'configuration');
assert.ok(!explainAuthError({code:'server_error',message:'postgres failed: internal secrets'},'login').message.includes('secrets'));
for(const p of ['app/(auth)/login/actions.ts','app/(auth)/signup/actions.ts'])assert.ok(read(p).includes('explainAuthError'));
assert.ok(read('app/(auth)/login/login-form.tsx').includes('Forgot password?'));
assert.ok(read('app/(auth)/signup/signup-form.tsx').includes('confirm_password'));
assert.ok(read('app/(auth)/signup/signup-form.tsx').includes('Try again in'));
assert.ok(read('app/(auth)/forgot-password/actions.ts').includes('rateLimited'));
assert.ok(read('app/(auth)/login/page.tsx').includes("loginError==='callback'"));
assert.ok(read('app/(dashboard)/pos/checkout-form.tsx').includes('Focus scanner'));
assert.ok(read('app/(dashboard)/pos/checkout-form.tsx').includes('Continue to payment'));
assert.ok(read('app/(dashboard)/pos/checkout-form.tsx').includes("window.confirm('Changing the stock location clears"));
assert.ok(read('app/admin/email/page.tsx').includes('does NOT automatically configure Supabase Auth emails'));
assert.ok(read('app/globals.css').includes('auth-friendly-form'));
for(const p of ['lib/auth-feedback.ts','app/(auth)/signup/actions.ts','app/(auth)/login/actions.ts','app/(auth)/signup/signup-form.tsx','app/(auth)/login/login-form.tsx','app/(auth)/forgot-password/actions.ts','app/(auth)/forgot-password/form.tsx','app/(dashboard)/pos/checkout-form.tsx']){
 const tree=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(tree.parseDiagnostics.length,0,p);
}
console.log('Authentication feedback, mobile forms and POS scanner usability source checks passed.');
