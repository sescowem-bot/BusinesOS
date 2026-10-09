# Phase 15 — Security and CI hardening (partial)

## Confirmed Vercel failure
Vercel commit `91da0c0` has duplicate routes `/login` and `/signup` from `app/login` plus `app/(auth)/login`, and `app/signup` plus `app/(auth)/signup`. Next.js route groups are not URL segments.

**The Phase 14 ZIP does not contain `app/login` or `app/signup`**. Only the authenticated grouped implementations exist. The deployed GitHub checkout therefore differs from this local archive. When merging into GitHub, remove the legacy duplicate root routes if their logic is obsolete, rather than removing the working `(auth)` routes. Check both paths' source and retain callbacks and auth actions. Do not delete route directories without reviewing changes.

## Added security features
- `scripts/check-routes.cjs` rejects duplicate App Router URLs before building.
- `next.config.ts` sends baseline security headers.
- `015_tenant_integrity.sql` enforces an automation template belonging to the same business, not only an RLS condition on insertion.
- GitHub Actions CI is added for route, type and build verification.

## Outstanding and not claimed complete
- No live Supabase DB, migration test or data reconciliation performed.
- No live auth/RLS penetration test or verified end-to-end access matrix.
- No Next.js production build verification without dependency install.
- No production readiness or compliance certification.
- Migrations may require order-sensitive, non-destructive staging validation.
- Baseline security headers are not a complete Content Security Policy.
- Other tenant references require exhaustive cross-table review.

## GitHub deployment repair
Review and delete `app/login/page.tsx` and `app/signup/page.tsx` in the live GitHub repository **only if** `app/(auth)/login/page.tsx` and `app/(auth)/signup/page.tsx` contain the intended authentication flows. Commit then redeploy. Route audit will detect any further collisions.
