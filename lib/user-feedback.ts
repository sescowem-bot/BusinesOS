/**
 * Safe user-facing failure text for Supabase/PostgREST/server actions.
 * Server-side logs/monitoring may retain diagnostics; NEVER return database messages,
 * stack traces, SQL migration names, table names or infrastructure details to a customer.
 */
export type ServiceFailure={code?:string|null;message?:string|null;status?:number|null};
export function friendlyServiceError(action:string,error?:ServiceFailure|null):string{
 const verb=action.replace(/[^a-zA-Z\s-]/g,'').trim().toLowerCase()||'complete this request';
 const code=error?.code||'';
 if(code==='P0001'&&typeof error?.message==='string'){
  if(error.message.includes('BUSINESS_USAGE_IMPORT_DATE_REVIEW_REQUIRED'))
   return 'Historical orders require a reviewed import. Please contact the business owner or support.';
  const match=/BUSINESS_USAGE_LIMIT_REACHED:\s*(customers|products|team_members|branches|orders_monthly)\b/.exec(error.message);
  if(match){
   const labels:Record<string,string>={customers:'customers',products:'products or services',team_members:'team members',branches:'branches',orders_monthly:'orders this month'};
   return 'Your subscription has reached its '+labels[match[1]]+' limit. Ask the owner to review the plan.';
  }
 }
 if(['42501','PGRST301','PGRST302'].includes(code)||error?.status===403)return `You don't have access to ${verb}. Ask your business owner for permission if you think this is a mistake.`;
 if(code==='23505')return `This record may already exist. Review your saved records before trying to ${verb} again.`;
 if(code==='23503')return `One of the selected records is no longer available. Refresh the page and try again.`;
 if(code==='40001'||code==='40P01')return `Your records changed while you were working. Refresh the page and try again.`;
 if(code==='23514'||code==='22P02')return `Some details need your attention. Check your entries and try again.`;
 if(code==='57014'||code==='PGRST003'||error?.status===504)return `This is taking longer than expected. Please try again in a moment.`;
 if(error?.status===429)return `Too many attempts. Please wait a few minutes and try again.`;
 return `We couldn't ${verb} right now. Please try again. If this continues, contact support.`;
}
