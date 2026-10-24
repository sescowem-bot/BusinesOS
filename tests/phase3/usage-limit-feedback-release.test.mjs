import {test} from 'node:test';import assert from 'node:assert/strict';
import {usageLimitFeedback} from '../../lib/phase3/usage-limit-feedback.ts';
test('quota codes produce safe user message',()=>assert.match(usageLimitFeedback({code:'P0001',message:'BUSINESS_USAGE_LIMIT_REACHED: customers'}),/plan/));
test('unknown database details are not echoed',()=>assert.equal(usageLimitFeedback({code:'P0001',message:'secret'}),null));
