/** A public contact link, never a user-supplied destination. Only international mobile numbers are accepted. */
export function whatsappUrl(phone:string, message='Hello, I would like to learn more about BusinessOS.'):string|null{
 const value=phone.trim();
 if(!value || !/^[+\d\s().-]+$/.test(value))return null;
 let digits=value.replace(/\D/g,'');
 if(digits.startsWith('00'))digits=digits.slice(2);
 if(digits.startsWith('0') && digits.length===11)digits='234'+digits.slice(1);
 if(!/^\d{10,15}$/.test(digits))return null;
 return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
export function phoneUrl(phone:string):string|null{
 if(!phone || !/^[+\d\s().-]+$/.test(phone))return null;
 const digits=phone.replace(/\D/g,'');
 return digits.length>=10 && digits.length<=15 ? `tel:${phone.replace(/[^+\d]/g,'')}` : null;
}
