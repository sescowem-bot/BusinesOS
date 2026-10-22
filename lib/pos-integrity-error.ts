/** Explain only authenticated SQL 064 financial integrity failures. */
export function checkoutPriceIntegrityMessage(error:{code?:string;message?:string}|null):string|null{
 if(error?.code!=='P0001')return null;
 const message=String(error.message||'');
 if(message.startsWith('VAT-inclusive total cannot be reconciled')||
    message.startsWith('VAT-inclusive discounted checkout requires finance review')){
  return 'VAT-inclusive prices cannot be reconciled for this sale. Nothing was saved. Ask a manager to review the prices before retrying.';
 }
 return null;
}
