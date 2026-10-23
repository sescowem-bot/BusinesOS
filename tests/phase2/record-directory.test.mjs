import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDirectory,directoryHref,DIRECTORY_SIZE} from '../../lib/record-directory.ts';
test('defaults to first page and never fetches all records',()=>{
 const q=parseDirectory({});assert.deepEqual([q.page,q.offset,q.size],[1,0,25]);assert.equal(DIRECTORY_SIZE,25);
});
test('can reach customer and transaction history beyond old 1000 row limit',()=>{
 const q=parseDirectory({page:'401'});assert.equal(q.offset,10000);assert.equal(q.page,401);
});
test('page inputs are bounded and invalid input resets safely',()=>{
 assert.equal(parseDirectory({page:'-1'}).page,1);
 assert.equal(parseDirectory({page:'1000000000'}).page,1);
 assert.equal(parseDirectory({page:'999999'}).page,10000);
 assert.equal(parseDirectory({page:['3','999']}).page,3);
});
test('filter grammar injection and SQL wildcard inputs are removed',()=>{
 const q=parseDirectory({q:'  Al%).or(id.eq.secret)_% " Ola  '});
 assert.ok(!/[(),%"_]/.test(q.q));assert.ok(q.q.length<=80);
});
test('international names, email and phone numbers stay searchable',()=>{
 const q=parseDirectory({q:'  Chidinma  Ọlábísí +234.80@example.com '});
 assert.match(q.q,/Ọlábísí/);assert.match(q.q,/@example.com/);
});
test('deep links preserve allowed customer IDs and encoded search',()=>{
 const customer='10000000-0000-4000-8000-000000000001';
 const url=directoryHref('/orders',{page:3,q:'Anu Ola',customer});
 assert.equal(url,'/orders?q=Anu+Ola&customer='+customer+'&page=3');
 assert.equal(parseDirectory({customer:'not-a-uuid'}).customer,null);
});
test('search state is preserved when navigating next and previous',()=>{
 assert.equal(directoryHref('/products',{page:2,q:'Soap',status:'active'}),'/products?q=Soap&status=active&page=2');
});
