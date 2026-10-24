/** Presentation only: quota enforcement happens in PostgreSQL, never in the browser. */
export function usageLimitFeedback(error?:{code?:string|null;message?:string|null}|null):string|null{
 if(error?.code!=='P0001'||typeof error.message!=='string')return null;
 if(error.message.includes('BUSINESS_USAGE_IMPORT_DATE_REVIEW_REQUIRED'))return 'Historical order dates require an authorised import review. No new order was saved.';
 const m=/BUSINESS_USAGE_LIMIT_REACHED:\s*(customers|products|team_members|branches|orders_monthly)\b/.exec(error.message);
 if(!m)return null;
 const labels:Record<string,string>={customers:'customers',products:'products or services',team_members:'staff',branches:'branches',orders_monthly:'orders this month'};
 return 'Your plan has reached its '+labels[m[1]]+' limit. Review your plan or ask the business owner to request an upgrade.';
}
