import {test} from 'node:test';import assert from 'node:assert/strict';
import {requestedPaidPlan,planStartUrl} from '../../lib/plan-selection.ts';
import {getPlanBillingBadge} from '../../lib/pricing-badge.ts';
test('plan selection is a safe navigation hint',()=>{
 assert.equal(requestedPaidPlan('starter'),'starter');assert.equal(requestedPaidPlan('free'),null);
 for(const v of ['../admin','https://elsewhere.com','professional?x=1','',null])assert.equal(requestedPaidPlan(v),null);
});
test('paid visitor reaches correct registration or checkout page',()=>{
 assert.equal(planStartUrl('growth','guest'),'/signup?plan=growth');
 assert.equal(planStartUrl('growth','business'),'/upgrade?plan=growth');
 assert.equal(planStartUrl('growth','onboarding'),'/onboarding?plan=growth');
 assert.equal(planStartUrl('growth','admin'),'/admin/my-business');
});
test('published price beats stale pilot badge copy',()=>{
 assert.equal(getPlanBillingBadge({id:'starter',billing_label:'PILOT ACCESS',price_monthly_ngn:2500,price_yearly_ngn:35000}),'MONTHLY & ANNUAL');
});
