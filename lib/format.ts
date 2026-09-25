export function money(value:number,currency='NGN'){return new Intl.NumberFormat('en-NG',{style:'currency',currency,maximumFractionDigits:0}).format(value)}
export function number(value:number){return new Intl.NumberFormat('en-NG').format(value)}
