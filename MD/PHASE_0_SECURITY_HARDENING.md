# BusinessOS Phase 0 — security foundation and shared rate limiting

Status: **SQL 057 and 058 are applied to the live BusinessOS Supabase project** after schema checks and explicit owner approval. SQL 059 is the follow-up hardening migration under CI review. The website changes are on the security branch; production website deployment remains gated on merge and the normal Vercel deployment.

## Migration order

| Migration | Purpose | Live status |
|---|---|---|
| 057 | Enables RLS and revokes public client grants on unused legacy catalog tables | Applied and verified |
| 058 | Adds atomic shared request counters for Route Handlers and Server Actions | Applied; live RPC test passed |
| 059 | Restricts anonymous execution of internal SECURITY DEFINER functions and locks trigger search paths | Added to PR; awaiting CI and live application |

Never edit migrations 001–056. Staging proposals named 057–062 are separate from the production migrations in this directory.

## Rate-limit design

- The global proxy guards every API request, the Supabase OAuth callback Route Handler and every Next.js Server Action POST (Next-Action header), including currently unused endpoints.
- Policies distinguish login, signup, recovery, checkout, exports, webhooks, internal automation, admin actions and general traffic.
- Authenticated traffic consumes IP and user buckets. IP limits run before contacting Supabase Auth.
- Bucket identifiers use HMAC-SHA256. Raw IPs and user IDs are not stored.
- Atomic PostgreSQL upserts share counters across serverless instances. No in-memory-only limiter is used.
- Exceeded requests return 429 with Retry-After. Missing credentials or database failure returns 503 (fail closed).
- Webhook limits are higher to tolerate provider retries; signature verification and idempotency remain mandatory.
- This is abuse protection, not authorization. Each handler/action must still verify identity, tenant, role and exact resource.

### Required server environment

Set SUPABASE_SERVICE_ROLE_KEY as a server-only Vercel secret and keep the Supabase URL configured. The production secret is already configured; a preview-only copy is also configured for verification. Optionally set RATE_LIMIT_HMAC_SECRET; otherwise the service-role key is used. Never expose either through a NEXT_PUBLIC_ variable. Missing credentials intentionally cause 503 on API and Server Action requests.

### Initial limits

| Surface | Limit |
|---|---:|
| Login | 8 / 15 minutes |
| Signup | 5 / hour |
| Password recovery | 3 / 15 minutes |
| Password reset | 6 / 15 minutes |
| Billing checkout | 8 / 10 minutes |
| Billing verification | 20 / 10 minutes |
| Exports/PDF | 5 / 10 minutes |
| Paystack/Resend webhooks | 300 / minute / IP |
| Internal automation | 30 / minute |
| General API | 120 / minute |
| Admin actions | 30 / minute |
| Other Server Actions | 45–60 / minute |

## Database function review

The live Security Advisor also identified anonymous execution grants on tenant accounting and membership functions. Migration 059 removes anonymous execution while retaining authenticated/service-role execution for the five tenant functions. It also removes direct API execution of the auth-user trigger function and locks trigger search paths. Published directory and published-plan functions are intentionally public and remain unchanged.

## CI and release gates

- npm run test:phase0 verifies headers, redaction, global guard coverage and hero slides.
- PostgreSQL 16 tests migrations 057, 058 and 059, including RLS, grants, rate-limit counters, trigger execution and function permissions.
- Existing regression tests, TypeScript and production build remain required.
- Review all remaining Security Advisor findings individually; do not bulk-change unrelated policies or public functions.
- Verify two-tenant isolation, auth, Paystack sandbox, Resend webhook retries and Vercel preview CSP.
