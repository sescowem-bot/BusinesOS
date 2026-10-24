/**
 * A requested subscription is only a navigation preference.
 * Never use it as an entitlement or payment authorization.
 */
export function requestedPaidPlan(value:unknown):string|null{
 return typeof value==='string'&&/^[a-z0-9][a-z0-9_-]{0,69}$/.test(value)&&value!=='free'?value:null;
}
export function planStartUrl(plan:string|null,viewer:'admin'|'business'|'onboarding'|'guest'):string{
 if(viewer==='admin')return '/admin/my-business';
 if(viewer==='business')return plan?'/upgrade?plan='+encodeURIComponent(plan):'/dashboard';
 if(viewer==='onboarding')return plan?'/onboarding?plan='+encodeURIComponent(plan):'/onboarding';
 return plan?'/signup?plan='+encodeURIComponent(plan):'/signup';
}
