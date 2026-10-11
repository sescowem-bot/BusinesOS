'use client';
import {useState} from 'react';
export function PlanCheckoutForm({planId,monthly,yearly,disabled=false}:{planId:string;monthly:number|null;yearly:number|null;disabled?:boolean}){
 const [cycle,setCycle]=useState<'monthly'|'yearly'>(monthly!=null?'monthly':'yearly');
 const available=(cycle==='monthly'?monthly:yearly)!=null && Number(cycle==='monthly'?monthly:yearly)>0;
 const ngn=(n:number)=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:2}).format(n);
 return <form method="post" action="/api/billing/checkout" className="bo-checkout-form"><input type="hidden" name="plan_id" value={planId}/><label>Billing period<select name="cycle" value={cycle} onChange={e=>setCycle(e.target.value as 'monthly'|'yearly')}><option value="monthly" disabled={monthly==null||monthly<=0}>Monthly {monthly!=null&&monthly>0?`· ${ngn(monthly)}`:''}</option><option value="yearly" disabled={yearly==null||yearly<=0}>Annual {yearly!=null&&yearly>0?`· ${ngn(yearly)}`:''}</option></select></label><button className="btn btn-primary" type="submit" disabled={disabled||!available}>Pay securely & activate</button><p className="small muted">Payments are processed by Paystack. Your plan activates after payment is verified. Your current access remains unchanged if payment fails.</p></form>;
}
