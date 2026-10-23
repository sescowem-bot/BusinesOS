/**
 * Paystack charges in integer NGN kobo.
 * Refuse ambiguous, over-precise or out-of-range prices rather than rounding them.
 * The server still reads prices from the published database record.
 */
export function priceToKobo(input:unknown):number|null{
 if(typeof input!=='string'&&typeof input!=='number')return null;
 if(typeof input==='number'&&!Number.isFinite(input))return null;
 const raw=String(input).trim();
 if(!/^(?:0|[1-9]\d{0,10})(?:\.(\d{1,2}))?$/.test(raw))return null;
 const [whole,decimal='']=raw.split('.');
 const kobo=BigInt(whole)*100n+BigInt(decimal.padEnd(2,'0'));
 // Same gateway amount limits as the previous production implementation.
 if(kobo<100n||kobo>999999999999n)return null;
 return Number(kobo);
}
