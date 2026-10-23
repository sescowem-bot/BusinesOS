import {test} from 'node:test';
import assert from 'node:assert/strict';
import {priceToKobo} from '../../lib/phase3/billing-policy.ts';

test('exact whole naira',()=>assert.equal(priceToKobo(5000),500000));
test('exact kobo no rounding',()=>assert.equal(priceToKobo('5000.07'),500007));
test('one-digit decimal',()=>assert.equal(priceToKobo('1500.5'),150050));
test('minimum supported amount',()=>assert.equal(priceToKobo('1.00'),100));
test('reject ambiguous fractional kobo',()=>assert.equal(priceToKobo('5.009'),null));
test('reject zero, below minimum and negatives',()=>{
 for(const v of [0,'0.00','0.99',-5,'-5'])assert.equal(priceToKobo(v),null);
});
test('reject huge and non-finite prices',()=>{
 for(const v of [Infinity,NaN,'99999999999',99999999999])assert.equal(priceToKobo(v),null);
});
test('reject exponential and formatted prices',()=>{
 for(const v of ['1e3','1,000.00','₦1200',''])assert.equal(priceToKobo(v),null);
});
test('unknown/null database price must not initiate checkout',()=>{
 for(const v of [null,undefined,{},true])assert.equal(priceToKobo(v),null);
});
test('reject overflows to provider maximum',()=>assert.equal(priceToKobo('10000000000.00'),null));
