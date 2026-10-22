import assert from 'node:assert/strict';
import {test} from 'node:test';
import {money} from '../../lib/format.ts';
import {previewPosPricing} from '../../lib/pos-pricing.ts';
import {minor,calculateVat} from '../../lib/tax/engine.ts';
import {balance,installmentSchedule,paidAmount} from '../../lib/calculations.ts';
import {csv,trialBalance,profitAndLoss} from '../../lib/reporting/financial.ts';

test('money displays kobo on NGN without mutating amount',()=>{
 assert.match(money(1000.35),/1,000\.35/);
 assert.match(money(0.01),/0\.01/);
});
test('VAT-inclusive POS guard blocks known one-kobo discrepancy',()=>{
 const r=previewPosPricing([{product_id:'a',quantity:1,price:0.07,rate:750}],'inclusive',0);
 assert.equal(r.integrityOk,false);
});
test('clean VAT-inclusive sale remains allowed',()=>{
 const r=previewPosPricing([{product_id:'a',quantity:1,price:1075,rate:750}],'inclusive',0);
 assert.equal(r.total,1075);assert.equal(r.integrityOk,true);
});
test('discounted inclusive preview is blocked while SQL 064 is active',()=>{
 const r=previewPosPricing([{product_id:'a',quantity:1,price:1075,rate:750}],'inclusive',20);
 assert.equal(r.integrityOk,false);
});
test('exclusive discounts preserve audited amounts',()=>{
 const r=previewPosPricing([{product_id:'a',quantity:1,price:1000,rate:750}],'exclusive',100);
 assert.equal(r.integrityOk,true);assert.equal(r.total,967.5);
});
test('minor units reject fractional kobo and negative amounts',()=>{
 assert.equal(minor('1.25'),125n);assert.throws(()=>minor('1.001'));assert.throws(()=>minor('-1'));
});
test('approved VAT and unapproved reviews do not silently mix',()=>{
 const t=calculateVat([{name:'A',quantity:1,unitPrice:'1000',approved:true,treatment:'standard'},
 {name:'B',quantity:1,unitPrice:'50',approved:false,treatment:'needs_review'}],true);
 assert.equal(t.vatMinor,7500n);assert.equal(t.status,'review_required');
});
test('payment totals exclude refunded and pending records',()=>{
 assert.equal(paidAmount([{amount:50,status:'completed'},{amount:500,status:'pending'},
 {amount:20,status:'refunded'}]),50);
 assert.equal(balance(99,[{amount:50,status:'completed'}]),49);
});
test('installments preserve two-decimal total',()=>{
 assert.equal(installmentSchedule(100,20,3).reduce((a,b)=>a+b,0),80);
});
test('spreadsheet export guards formula injection',()=>{
 const v=csv([['=1+1','@HYPERLINK','-10']]);
 assert.ok(v.includes("'=1+1"));assert.ok(v.includes("'@HYPERLINK"));
});
test('trial balance / P&L math executes',()=>{
 const rows=[{account_id:'1',code:'1',name:'Cash',class:'asset',debit_turnover:100,credit_turnover:0,signed_balance:100},
 {account_id:'2',code:'2',name:'Sales',class:'income',debit_turnover:0,credit_turnover:100,signed_balance:-100}];
 assert.equal(trialBalance(rows).difference,0);
 assert.equal(profitAndLoss(rows).net,100);
});
