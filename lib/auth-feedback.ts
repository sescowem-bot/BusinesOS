/** Safe, customer-facing error classification. Do not echo raw Auth API messages. */
export type AuthFeedback={message:string;retryAfterSeconds:number;reason:'rate_limit'|'unconfirmed'|'credentials'|'configuration'|'general'};
export type AuthErrorLike={code?:string|null;message?:string|null;status?:number|null};

export function extractAuthRetrySeconds(message:string):number{
 const match=message.match(/(?:after|in|retry(?:\s+again)?\s+in)\s+(\d+)\s*(seconds?|minutes?)/i);
 if(!match)return 0;
 const value=Number(match[1])*(match[2].toLowerCase().startsWith('minute')?60:1);
 return Number.isFinite(value)?Math.min(3600,Math.max(1,value)):0;
}
export function explainAuthError(error:AuthErrorLike,flow:'signup'|'login'|'recovery'):AuthFeedback{
 const code=(error.code||'').toLowerCase();
 const message=error.message||'';
 if(code==='over_email_send_rate_limit'||code==='email_rate_limit_exceeded'||code==='over_request_rate_limit'||
   code==='too_many_requests'||error.status===429||/rate limit|only request this after/i.test(message)){
  const seconds=extractAuthRetrySeconds(message)||60;
  const text=flow==='signup'?'Confirmation email requests are temporarily limited. Please wait before trying again. If this continues, contact support.':
   flow==='recovery'?'Password reset emails are temporarily limited. Please try again later.':'Too many sign-in attempts. Please wait before trying again.';
  return {message:text,retryAfterSeconds:seconds,reason:'rate_limit'};
 }
 if(code==='email_not_confirmed')return {message:'Your email is not confirmed yet. Open your verification email, including Spam/Junk, then sign in.',retryAfterSeconds:0,reason:'unconfirmed'};
 if(code==='invalid_credentials'||code==='invalid_grant')return {message:'The email or password could not be verified. Check your details or reset your password.',retryAfterSeconds:0,reason:'credentials'};
 if(code==='email_address_not_authorized')return {message:'Email confirmation is not available for this address yet. Please contact BusinessOS support.',retryAfterSeconds:0,reason:'configuration'};
 return {message:flow==='signup'?'We could not complete registration. Please try again or contact support.':flow==='login'?'Sign in is temporarily unavailable. Please try again.':'Password reset could not be requested. Please try again later.',retryAfterSeconds:0,reason:'general'};
}
