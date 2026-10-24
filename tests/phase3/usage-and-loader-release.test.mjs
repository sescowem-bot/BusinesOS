import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=p=>readFileSync(p,'utf8');
test('brand loader restored with ring logo and name',()=>{
 const src=load('components/workspace-loading-brand.tsx');
 for(const token of ['bo-premium-loader__ring','bo-premium-loader__symbol','bo-premium-loader__name','bo-premium-loader__label'])assert.ok(src.includes(token));
 assert.doesNotMatch(src,/setTimeout|Retry page|Back to website|location\.reload/);
});
test('usage limits never exposes engineering staging instructions',()=>{
 const src=load('app/admin/usage-limits/page.tsx');
 for(const token of ['System Owner','Usage limits','platform_plan_usage_limits','LimitEditor','TrialEditor']) assert.ok(src.includes(token));
 assert.doesNotMatch(src,/staging-only|disposable staging|Run it in|Run SQL|execute SQL|migration\.sql/i);
 assert.match(src,/requirePlatformAdmin/);
});
test('usage screen does not imply caps are active when backend missing',()=>{
 const src=load('app/admin/usage-limits/page.tsx');
 assert.match(src,/!ready/);
 assert.match(src,/Usage settings are being configured/);
 assert.match(src,/flag\.data\?\.enabled===true/);
 assert.match(src,/Numerical enforcement is not yet active/);
});
test('authentication stays useful and safe',()=>{
 const src=load('lib/auth-feedback.ts');
 assert.match(src,/invalid_credentials/);assert.match(src,/reset your password/);
 assert.doesNotMatch(load('app/(auth)/login/actions.ts'),/SUPABASE_SERVICE_ROLE_KEY/);
});
