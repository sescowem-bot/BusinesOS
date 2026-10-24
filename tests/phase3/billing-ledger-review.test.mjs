import {test} from 'node:test';import assert from 'node:assert/strict';
import {amountNGN,paymentStatus,validPage,validBusinessId} from '../../lib/phase3/billing-ledger.ts';
test('unconfirmed checkout is not failed',()=>assert.equal(paymentStatus({status:'initiated',created_at:'2026-10-01T10:00:00Z'},Date.parse('2026-10-01T12:00:00Z')).alert,true));
test('paid record needs dates',()=>assert.equal(paymentStatus({status:'paid',created_at:'2026-10-01'},0).alert,true));
test('safe amounts and search',()=>{assert.equal(amountNGN(7),'₦0.07');assert.equal(validPage('999'),1);assert.ok(validBusinessId('d1c7bf5e-9d48-4287-814a-3786db7a9df1'))});
