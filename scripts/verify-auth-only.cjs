const fs=require('node:fs'),assert=require('node:assert/strict');const read=p=>fs.readFileSync(p,'utf8');
let ts;try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js')}
const code=read('lib/auth-feedback.ts'),js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const sandboxModule={exports:{}};new Function('module','exports',js)(sandboxModule,sandboxModule.exports);
const f=sandboxModule.exports.explainAuthError;
assert.equal(f({code:'over_email_send_rate_limit',message:'only request this after 36 seconds'},'signup').retryAfterSeconds,36);
assert.equal(f({code:'email_not_confirmed'},'login').reason,'unconfirmed');
assert.equal(f({code:'invalid_credentials'},'login').reason,'credentials');
assert.ok(!f({code:'other',message:'secret database name'},'login').message.includes('database name'));
assert.ok(read('app/(auth)/login/login-form.tsx').includes('Forgot password?'));
assert.ok(read('app/(auth)/signup/signup-form.tsx').includes('confirm_password'));
assert.ok(read('app/(auth)/forgot-password/actions.ts').includes('rateLimited'));
assert.ok(read('app/(auth)/login/page.tsx').includes("loginError==='callback'"));
console.log('Auth-only source verification passed.');
