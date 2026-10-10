const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=process.cwd();
function read(p){return fs.readFileSync(`${root}/${p}`,'utf8')}
const migration=read('supabase/migrations/025_email_delivery_tracking.sql');
const app=read('app/admin/email/page.tsx'),action=read('app/admin/email/actions.ts');
const server=read('app/api/webhooks/resend/route.ts');
const hook=read('supabase/functions/send-email/index.ts');
assert.match(migration,/admin_begin_email_test/);
assert.match(migration,/auth\.uid\(\)/);
assert.match(migration,/platform_email_webhook_events/);
assert.match(migration,/trg_notification_payment_completed/);
assert.match(migration,/ON CONFLICT DO NOTHING/);
assert.match(read('app/admin/email/test-form.tsx'),/Send test to my email/);
assert.match(app,/Preview branded email/);
assert.match(action,/sendAdminTestEmail/);
assert.match(action,/session\.user\.email/);
assert.match(server,/verifyResendSignature/);
assert.match(hook,/new Webhook\(hookSecret\)\.verify/);
assert.match(hook,/ENABLE_AUTH_RESEND_EMAIL/);
assert.match(hook,/ALLOWED_AUTH_REDIRECT_ORIGINS/);
assert(!/NEXT_PUBLIC_(RESEND|SUPABASE_SERVICE_ROLE_KEY)/.test(read('.env.example')));
const docs=fs.readdirSync(root).filter(f=>f.toLowerCase().endsWith('.md'));
assert.deepEqual(docs,['README.md']);
const p=read('lib/server/email-webhook-verification.ts');
const body='{"type":"email.delivered","data":{"email_id":"email_fake"}}';
const id='msg_test_001',stamp=String(Math.floor(Date.now()/1000));
const secret='whsec_'+crypto.randomBytes(24).toString('base64');
const sig='v1,'+crypto.createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`${id}.${stamp}.${body}`).digest('base64');
// Use the global TypeScript install when available; assertion also checks wire format.
try{
 const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
 const source=ts.transpileModule(p,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const Module=require('node:module'),m=new Module('verify-ts',module);m.filename='verify-ts';m.paths=module.paths;m._compile(source,'verify-ts');
 assert(m.exports.verifyResendSignature(body,new Headers({'svix-id':id,'svix-timestamp':stamp,'svix-signature':sig}),secret));
 assert(!m.exports.verifyResendSignature(body+' ',new Headers({'svix-id':id,'svix-timestamp':stamp,'svix-signature':sig}),secret));
 assert(!m.exports.verifyResendSignature(body,new Headers({'svix-id':id,'svix-timestamp':String(Number(stamp)-1000),'svix-signature':sig}),secret));
 console.log('Resend signature smoke tests: passed');
}catch(error){console.error(error);process.exitCode=1}
console.log('Phase 026 source integrity checks: passed');
