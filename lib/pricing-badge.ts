/** Customer-facing labels are independent from subscription checkout prices. */
export type PlanBadgeFields={
 id:string;
 billing_label?:string|null;
 price_monthly_ngn?:number|null;
 price_yearly_ngn?:number|null;
};
const PENDING=/\b(?:pricing\s+(?:to\s+be\s+confirmed|pending)|price\s+(?:to\s+be\s+confirmed|pending)|coming\s+soon|contact\s+(?:us\s+)?for\s+pricing|tbd|to\s+be\s+confirmed)\b/i;
export function hasPublishedAmount(p:PlanBadgeFields){
 return [p.price_monthly_ngn,p.price_yearly_ngn].some(n=>n!=null&&Number.isFinite(Number(n))&&Number(n)>0);
}
export function getPlanBillingBadge(p:PlanBadgeFields):string{
 if(p.id==='free')return 'FREE FOREVER';
 const label=(p.billing_label||'').trim();
 if(hasPublishedAmount(p)&&PENDING.test(label)){
  if(Number(p.price_monthly_ngn)>0&&Number(p.price_yearly_ngn)>0)return 'MONTHLY & ANNUAL';
  if(Number(p.price_monthly_ngn)>0)return 'MONTHLY PLAN';
  return 'ANNUAL PLAN';
 }
 return label||'BUSINESS PLAN';
}
