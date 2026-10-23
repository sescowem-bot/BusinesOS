/** Display-only checks; server-side validation remains authoritative. */
export type FieldMessage={valid:boolean;message:string};
export function nameFieldMessage(value:string,min:number,max:number,label:string):FieldMessage{
 const n=value.trim().length;
 if(n===0)return {valid:false,message:`Enter ${label.toLowerCase()}.`};
 if(n<min)return {valid:false,message:`${label} must be at least ${min} characters.`};
 if(n>max)return {valid:false,message:`${label} must be ${max} characters or fewer.`};
 return {valid:true,message:''};
}
export function amountFieldMessage(value:string,label:string):FieldMessage{
 const raw=value.trim();if(!raw)return {valid:false,message:`Enter ${label.toLowerCase()}.`};
 if(!/^(?:\d+)(?:\.\d{1,2})?$/.test(raw))return {valid:false,message:`${label} must be a non-negative amount with at most two decimal places.`};
 if(!Number.isFinite(Number(raw)))return {valid:false,message:`${label} is too large.`};
 return {valid:true,message:''};
}
