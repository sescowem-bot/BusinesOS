/** Pure reporting functions. Amounts should originate from Postgres numeric(18,2), parsed at the boundary. */
export type LedgerLine={account_id:string;code:string;name:string;class:string;debit:number;credit:number;date:string;reference?:string};
export type TrialRow={account_id:string;code:string;name:string;class:string;debit_turnover:number;credit_turnover:number;signed_balance:number};
export function profitAndLoss(rows:TrialRow[]){
 const income=rows.filter(r=>r.class==='income').reduce((s,r)=>s-r.signed_balance,0);
 const expense=rows.filter(r=>r.class==='expense').reduce((s,r)=>s+r.signed_balance,0);
 return {income:round(income),expense:round(expense),net:round(income-expense)};
}
export function balanceSheet(rows:TrialRow[]){
 const sum=(cls:string)=>rows.filter(r=>r.class===cls).reduce((s,r)=>s+r.signed_balance,0);
 const assets=round(sum('asset')),liabilities=round(-sum('liability')),equity=round(-sum('equity'));
 const pl=profitAndLoss(rows);return {assets,liabilities,equity,currentEarnings:pl.net,difference:round(assets-liabilities-equity-pl.net)};
}
export function trialBalance(rows:TrialRow[]){const debit=round(rows.reduce((s,r)=>s+Math.max(0,r.signed_balance),0));const credit=round(rows.reduce((s,r)=>s+Math.max(0,-r.signed_balance),0));return {debit,credit,difference:round(debit-credit)}};
export const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export function csvCell(value:unknown){const s=String(value??'');const guarded=/^[\t\r\n ]*[=+@-]/.test(s)?"'"+s:s;return /[",\r\n]/.test(guarded)?'"'+guarded.replace(/"/g,'""')+'"':guarded}
export function csv(rows:unknown[][]){return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n'}
