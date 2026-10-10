/** Read-only HTTP smoke check for a deployed BusinessOS Preview environment.
 * No login, submissions, database modifications or secret-bearing requests. */
'use strict';
const urlInput=process.argv[2]||process.env.PILOT_BASE_URL;
if(!urlInput||process.argv.includes('--help')){
 console.log('Usage: npm run smoke:pilot -- https://your-preview-domain.vercel.app');
 process.exit(urlInput?0:2);
}
let base;
try{
 base=new URL(urlInput);
 if(base.username||base.password||base.search||base.hash)throw Error('Use a clean base URL without credentials or tokens');
 if(base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1'].includes(base.hostname)))throw Error('HTTPS required outside localhost');
}catch(error){console.error('Invalid pilot URL:',error.message);process.exit(2)}
base.pathname='/';
const publicRoutes=['/','/features','/solutions','/how-it-works','/pricing','/about','/privacy','/terms','/cookies','/login','/signup'];
const protectedRoutes=['/admin','/admin/pilot','/api/setup-status'];
const request=async path=>{
 const url=new URL(path,base);
 const response=await fetch(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'User-Agent':'BusinessOS-Pilot-Smoke/1.0'}});
 return {status:response.status,location:response.headers.get('location')||''};
};
(async()=>{
 let failed=0;
 for(const path of publicRoutes){
  try{
   const res=await request(path),ok=res.status===200;
   console.log(`${ok?'PASS':'FAIL'} public ${path}: ${res.status}`);if(!ok)failed++;
  }catch(e){console.error(`FAIL public ${path}: ${e.message}`);failed++}
 }
 for(const path of protectedRoutes){
  try{
   const res=await request(path);
   const ok=[301,302,303,307,308,401,403].includes(res.status)&&(![301,302,303,307,308].includes(res.status)||(/\/login(?:[/?#]|$)/.test(res.location)));
   console.log(`${ok?'PASS':'FAIL'} denied anonymous ${path}: ${res.status}`);if(!ok)failed++;
  }catch(e){console.error(`FAIL protected ${path}: ${e.message}`);failed++}
 }
 console.log(`Completed ${publicRoutes.length+protectedRoutes.length} read-only requests; failures: ${failed}.`);
 console.log('This is not authentication, database, RLS, finance or email acceptance testing.');
 process.exitCode=failed?1:0;
})().catch(err=>{console.error(err.message);process.exitCode=1});
