# Phase 0: security and reproducible builds

Status: **Review branch only.** This release does not modify a live Supabase database, run checkout payments, or configure production observability accounts.

## Exact changed files

| Item | Files | Nature |
|---|---|---|
| Legacy catalog permissions | `supabase/migrations/057_lock_down_legacy_catalog_tables.sql`, `supabase/tests/phase0_057_rls_execution.sql`, `supabase/tests/phase0_production_rls_advisor_READ_ONLY.sql`, `supabase/migrations/README_UPCOMING_057_062.md` | RLS hardening, executable PostgreSQL role tests, read-only live-advisor query, numbering guard |
| Reproducible installs | `package-lock.json`, `.github/workflows/verify.yml` | npm-generated lockfile and mandatory `npm ci` |
| HTTP security | `next.config.ts`, `tests/phase0-security.test.mjs` | Enforced CSP/HSTS and executable JavaScript header tests |
| Server error monitoring | `instrumentation.ts`, `lib/monitoring/server-error.ts`, `tests/phase0-security.test.mjs` | Next.js request error handler, PII-redacted Vercel runtime logs, opt-in Sentry relay envelope |
| Process/commands | `package.json`, `README.md`, this guide | npm test script and release instructions |

The temporary GitHub Actions lockfile bootstrap workflow was deleted after generating a valid `package-lock.json`. No enduring CI workflow commits to the protected release branch.

## Migration 057

Legacy tables `public.subscription_plans` and `public.partner_organizations` were created by migration 001 without RLS. Migration 057 enables RLS and revokes public/anon/authenticated privileges on them. It retains every existing row and foreign key; no DROP or DELETE is performed. **It intentionally refuses to proceed if one of those tables is missing or has existing policies**, because that indicates unexpected production schema drift.

**Warning:** Files with labels 057–062 in `supabase/staging-review` are separate, incomplete proposals. The staged 057 must never be mistaken for this production 057. Renumber each approved staged migration to an unused production number after code and security review. Never edit already-installed migrations 001–056 to reconcile this.

Before installing:

1. Back up the staging database, document the schema and check whether any existing functions rely on querying the two tables in user contexts. Ensure reporting and billing read from the supported current plan tables, not the legacy ones.
2. Apply migration 057 **on staging only**. Record the execution and check which database privileges/functions are affected.
3. Run `supabase/tests/phase0_production_rls_advisor_READ_ONLY.sql`. Review the *entire list* of tables lacking RLS. The new migration addresses only the two named tables; do not assume a zero-finding result.
4. Verify public catalog pages, business creation, subscriptions, customer login and System Owner operations.
5. Execute the migration only once in live Supabase after explicit review. Do not use the disposable CI test script on live data; it creates mock roles/tables for an empty Postgres database.

CI runs `supabase/tests/phase0_057_rls_execution.sql` on PostgreSQL 16, testing actual SQL execution twice (idempotence), pre-existing row preservation, RLS enablement, no policies, revoked grants, denied reads, denied updates and denied inserts with actual anon/authenticated roles. This is **not** a substitute for real Supabase Auth JWT and existing SECURITY DEFINER regression tests.

## Locked dependencies

The lockfile was generated via `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` using Node 22, then `npm ci` successfully installed the locked tree in GitHub Actions. CI now uses `npm ci --no-audit --no-fund` without falling back to uncontrolled npm install. Review changes to package-lock.json whenever package.json changes.

## CSP/HSTS checks

`next.config.ts` now provides an **enforced** content security policy limiting scripts, frames, object embedding, form targets and outgoing browser requests. It allows official Supabase and Paystack origins, Vercel analytics, Cloudinary and Google Analytics. It also sends HSTS. To preserve Next.js hydration and existing inline styles, this first release permits `'unsafe-inline'`; removing it requires nonce-based policy adoption and a UI audit.

Run `npm run test:phase0`, `npm run typecheck`, and `npm run build` after clean `npm ci`.

Production/preview browser verification still required: sign in and reset password (Supabase), start and return from a **Paystack sandbox** checkout, inspect browser CSP violations, load branded images/analytics, and test real Vercel preview. The automated checks verify effective header configuration, **not** third-party runtime behavior. Add any custom Supabase domain or provider hostname only after reviewing the actual browser violation, never by default widening `script-src` to `*`.

## Error monitoring

Next.js `instrumentation.ts` sends server request error events to Vercel runtime logs, and optionally to Sentry ingest when **server-only** `BUSINESSOS_SENTRY_DSN` is configured. Do not use a `NEXT_PUBLIC_` prefix. The redacted event contains only generated event id, UTC timestamp, generic error class, **route pattern (never actual URL or query)** and environment; it strips raw stack, exception message, request, user IP, headers, body, cookies and identifiers. Unsafe route templates become `/unknown`. A failed monitoring request is swallowed and never blocks a customer workflow.

This provides sanitized server-side exception reporting but does **not** yet include browser errors, alert rules, retention settings, or verified delivery to a real Sentry project. Configure Sentry project/DSN and alerting, perform a controlled test, and document retention before claiming monitoring is live.

## Release gates

- GitHub Actions passes nextjs (including npm ci, route/feature checks, Phase 0 test, TypeScript and production build), deno-auth-hook, and phase0-postgres.
- Confirm the Security Advisor result against the actual intended Supabase environment. Address any other public tables missing RLS with separately reviewed migrations.
- Verify CSP, Paystack, Supabase, branding and runtime monitoring on a real Vercel preview.
- Confirm application behavior for two tenants and existing system owner/admin workspaces.
- Never merge or deploy solely because static checks pass. Preserve the unrelated access-management PR #15 for a separate review.

Phase 1 starts only after separate approval.
