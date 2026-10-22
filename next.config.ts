import type {NextConfig} from 'next';

// Phased enforcement: retain Next.js hydration and existing inline styles while restricting
// external executables, framing, embedding, and network destinations.
// Revisit inline allowances when nonce-based CSP is deployed in a separate phase.
const csp=[
 "default-src 'self'",
 "base-uri 'self'",
 "object-src 'none'",
 "frame-ancestors 'none'",
 "form-action 'self' https://checkout.paystack.com https://*.paystack.co",
 "script-src 'self' 'unsafe-inline' https://js.paystack.co https://checkout.paystack.com https://*.paystack.co https://www.googletagmanager.com",
 "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
 "font-src 'self' data: https://fonts.gstatic.com",
 "img-src 'self' data: blob: https:",
 "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.paystack.co https://*.paystack.co https://*.cloudinary.com https://www.google-analytics.com https://*.google-analytics.com https://*.vercel-insights.com",
 "frame-src https://checkout.paystack.com https://*.paystack.co",
 "media-src 'self' blob: https:",
 "worker-src 'self' blob:",
 "upgrade-insecure-requests"
].join('; ');

const nextConfig:NextConfig={
 async headers(){
  return [{source:'/:path*',headers:[
   {key:'Content-Security-Policy',value:csp},
   {key:'Strict-Transport-Security',value:'max-age=31536000'},
   {key:'X-Content-Type-Options',value:'nosniff'},
   {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
   {key:'X-Frame-Options',value:'DENY'},
   {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
  ]}];
 }
};
export default nextConfig;
