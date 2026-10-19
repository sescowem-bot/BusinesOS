/** BusinessOS opt-in device persistence: session cookies on shared devices,
 * capped persistent auth cookies when user explicitly checks Stay signed in.
 * Cookie expiry is not an Auth server-side session revocation mechanism.
 */
export const DEVICE_SESSION_COOKIE='businessos_device_session';
export const REMEMBER_DEVICE_MAX_AGE=60*60*24*30;
export function authCookieOptions<T extends {maxAge?:number;expires?:Date}>(original:T,remember:boolean):T{
 // Preserve Supabase cookie deletion instructions (Max-Age=0) exactly.
 if(original.maxAge===0 || (original.expires instanceof Date&&original.expires.getTime()<=Date.now()))return original;
 const options={...original};
 delete options.maxAge;
 delete options.expires;
 if(remember) options.maxAge=REMEMBER_DEVICE_MAX_AGE;
 return options;
}
