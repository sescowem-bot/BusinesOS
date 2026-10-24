/** Derive subscription badge from real published amounts, not stale CMS text. */
export type PlanBadgeFields={id:string;billing_label?:string|null;price_monthly_ngn?:number|null;price_yearly_ngn?:number|null};
export function hasPublishedAmount(p:PlanBadgeFields){
 return [p.price_monthly_ngn,p.price_yearly_ngn].some(n=>n!=null&&Number.isFinite(Number(n))&&Number(n)>0);
}
export function getPlanBillingBadge(p:PlanBadgeFields):string{
 if(p.id==='free')return 'FREE FOREVER';
 if(hasPublishedAmount(p)){
  if(Number(p.price_monthly_ngn)>0&&Number(p.price_yearly_ngn)>0)return 'MONTHLY & ANNUAL';
  if(Number(p.price_monthly_ngn)>0)return 'MONTHLY PLAN';
  return 'ANNUAL PLAN';
 }
 return 'REQUEST PRICING';
}
