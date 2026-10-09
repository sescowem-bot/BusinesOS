import {strict as assert} from 'node:assert';
import {calculateVat,minor} from '../lib/tax/engine';
assert.equal(minor('120.05'),12005n);
assert.throws(()=>minor('12.001'));
const lines=[{name:'Approved standard',quantity:2,unitPrice:'1000',treatment:'standard' as const,approved:true},{name:'Zero',quantity:1,unitPrice:'500',treatment:'zero_rated' as const,approved:true},{name:'Unclassified',quantity:1,unitPrice:'300',treatment:'needs_review' as const,approved:false}];
const result=calculateVat(lines,true);assert.equal(result.vatMinor,15000n);assert.equal(result.netMinor,280000n);assert.equal(result.status,'review_required');
assert.equal(calculateVat([lines[0]],false).vatMinor,0n);
assert.throws(()=>calculateVat([{...lines[0],quantity:0}],true));
console.log('PASS: integer money, mixed lines, blocked unapproved, eligibility, quantity validation');
