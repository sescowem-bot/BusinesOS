import {strict as assert} from 'node:assert';
import {balanceSheet,csv,profitAndLoss,trialBalance,type TrialRow} from '../lib/reporting/financial';
const rows:TrialRow[]=[
{account_id:'a',code:'100',name:'Bank',class:'asset',debit_turnover:150000,credit_turnover:50000,signed_balance:100000},
{account_id:'b',code:'300',name:'Capital',class:'equity',debit_turnover:0,credit_turnover:80000,signed_balance:-80000},
{account_id:'c',code:'400',name:'Sales',class:'income',debit_turnover:0,credit_turnover:30000,signed_balance:-30000},
{account_id:'d',code:'500',name:'Rent',class:'expense',debit_turnover:10000,credit_turnover:0,signed_balance:10000}
];
assert.equal(trialBalance(rows).difference,0);
assert.deepEqual(profitAndLoss(rows),{income:30000,expense:10000,net:20000});
assert.equal(balanceSheet(rows).difference,0);
assert.ok(csv([['Name','Value'],['=DANGEROUS','hello, world']]).includes("'=DANGEROUS"));
assert.ok(csv([['Name','Value'],['a','b"c']]).includes('"b""c"'));
console.log('Phase 09 reporting tests passed (balances, P&L, financial equation, CSV escaping)');
