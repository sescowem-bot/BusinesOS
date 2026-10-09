export type OrderLine={quantity:number;unitPrice:number;unitCost:number};
export type Payment={amount:number;status?:'completed'|'pending'|'failed'|'refunded'|'voided'};
export function orderTotals(lines:OrderLine[],discount=0,tax=0,delivery=0){const subtotal=lines.reduce((s,l)=>s+l.quantity*l.unitPrice,0);const total=Math.max(0,subtotal-discount+tax+delivery);const cogs=lines.reduce((s,l)=>s+l.quantity*l.unitCost,0);return {subtotal,discount,tax,delivery,total,cogs,grossProfit:total-cogs};}
export function paidAmount(payments:Payment[]){return payments.filter(p=>!p.status||p.status==='completed').reduce((s,p)=>s+p.amount,0)}
export function balance(orderTotal:number,payments:Payment[]){return Math.max(0,orderTotal-paidAmount(payments))}
export function estimatedProfit(sales:number,cogs:number,expenses:number){return sales-cogs-expenses}
export function profitMargin(sales:number,profit:number){return sales<=0?0:(profit/sales)*100}
export function breakEvenUnits(fixedCosts:number,unitSellingPrice:number,unitVariableCost:number){const contribution=unitSellingPrice-unitVariableCost;return contribution<=0?Infinity:Math.ceil(fixedCosts/contribution)}
export function suggestedPrice(cost:number,directCosts:number,targetMarginPercent:number){const base=cost+directCosts;const margin=Math.min(99.99,Math.max(0,targetMarginPercent));return base/(1-margin/100)}
export function installmentSchedule(total:number,deposit:number,count:number){if(count<=0)throw new Error('Installment count must be greater than zero');const remaining=Math.max(0,total-deposit);const base=Math.floor((remaining/count)*100)/100;const schedule=Array.from({length:count},(_,i)=>i<count-1?base:Math.round((remaining-base*(count-1))*100)/100);return schedule}
