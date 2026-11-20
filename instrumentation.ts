import {reportRedactedServerError} from './lib/monitoring/server-error';
export function register(){}
// Next.js 16 request error instrumentation. Deliberately ignore request headers,
// dynamic URL, query parameters, and raw exception messages.
export async function onRequestError(
 error:unknown,
 _request:unknown,
 context:{routePath?:string;routerKind?:string}
){
 await reportRedactedServerError(error,context);
}
