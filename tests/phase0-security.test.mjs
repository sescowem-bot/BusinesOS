import assert from 'node:assert/strict';
import {test} from 'node:test';
import nextConfig from '../next.config.ts';
import {makeRedactedErrorEvent,reportRedactedServerError} from '../lib/monitoring/server-error.ts';

test('security headers execute and enforce CSP/HSTS',async()=>{
 const routeRules=await nextConfig.headers?.();
 assert.ok(routeRules&&routeRules.length);
 const policy=Object.fromEntries(routeRules[0].headers.map(h=>[h.key,h.value]));
 assert.match(policy['Content-Security-Policy'],/default-src 'self'/);
 assert.match(policy['Content-Security-Policy'],/object-src 'none'/);
 assert.match(policy['Content-Security-Policy'],/frame-ancestors 'none'/);
 assert.match(policy['Content-Security-Policy'],/https:\/\/\*\.supabase\.co/);
 assert.match(policy['Content-Security-Policy'],/https:\/\/js\.paystack\.co/);
 assert.match(policy['Content-Security-Policy'],/https:\/\/api\.paystack\.co/);
 assert.match(policy['Strict-Transport-Security'],/max-age=31536000/);
});
test('monitoring event does not reveal PII, query parameters, tokens or error stack',()=>{
 const err=new Error('Bank PIN 1234; john@example.com; session=secret');
 const event=makeRedactedErrorEvent(err,{routePath:'/orders/[id]',routerKind:'app'});
 const raw=JSON.stringify(event);
 assert.equal(event.tags.route_template,'/orders/[id]');
 for(const sensitive of ['1234','john@example.com','session=secret','Bank PIN'])
  assert.equal(raw.includes(sensitive),false,`Monitoring leaked ${sensitive}`);
 assert.equal(event.exception.values[0].type,'Error');
});
test('unsafe route strings are not captured',()=>{
 const event=makeRedactedErrorEvent(new Error('secret'),{routePath:'/users/alice@example.com?token=abc'});
 assert.equal(event.tags.route_template,'/unknown');
});
test('without DSN monitoring logs only redacted event and makes no external request',async()=>{
 const old=process.env.BUSINESSOS_SENTRY_DSN;
 const oldFetch=globalThis.fetch,oldLog=console.error;
 const logged=[];let calls=0;
 try{
  delete process.env.BUSINESSOS_SENTRY_DSN;
  globalThis.fetch=async()=>{calls++;throw new Error('External request unexpectedly sent')};
  console.error=(...values)=>logged.push(values.join(' '));
  await reportRedactedServerError(new Error('token secret and alice@example.com'),{routePath:'/dashboard'});
  assert.equal(calls,0);
  assert.equal(logged.length,1);
  assert.equal(logged[0].includes('alice@example.com'),false);
  assert.equal(logged[0].includes('token secret'),false);
 }finally{
  process.env.BUSINESSOS_SENTRY_DSN=old;
  if(old===undefined)delete process.env.BUSINESSOS_SENTRY_DSN;
  globalThis.fetch=oldFetch;console.error=oldLog;
 }
});
