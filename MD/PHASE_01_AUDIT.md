# Phase 01 — Source audit (9 October 2026)

## Scope and baseline
Inspected both user-uploaded ZIP archives. Used `business-platform-premium(1).zip` as baseline because it includes the premium interface. Inspection is **static**: no production Supabase connection, credentials, deployment or successful dependency installation was supplied. This is a **demo/prototype, not a deployable production accounting or tax service**.

## Confirmed technical inventory
- Next.js `16.3.1` declared; React `19.2.0`, TypeScript `^5.7.2`, Supabase JS `^2.57.0`, Supabase SSR `^0.7.0`, Zod `^4.1.0`.
- Next App Router, CSS in `app/globals.css`, UI in `components/`, React pages in `app/`.
- Database is one baseline migration `supabase/migrations/001_core.sql`; RLS policies and helper functions declared, but live database is unverified.
- Demo routes: landing, login, signup, dashboard, orders, customers, products, inventory, payments, expenses, reports, insights, quotes, invoices, tasks, partners, marketplace, settings, admin.
- Financial math is in `lib/calculations.ts`; tests exist in `tests/calculations.test.ts` but testing framework and runner are not configured.

## Critical security and functionality findings
1. **Critical — authentication is not implemented.** `app/(auth)/login/page.tsx` submits a regular form to `/dashboard`; no password verification. Sign-up must also be wired to auth before real users can be enrolled.
2. **Critical — dashboard access is not guarded.** `app/(dashboard)/layout.tsx` provides a shell without validated authentication or organisation membership. Demo data should not be mistaken for private production records.
3. **Critical — exposed admin simulation.** Original `app/admin/page.tsx` showed unverified platform metrics without access control. This Phase 01 copy fails closed at `/admin` and removes its navigation link until proper server-side Super Admin RBAC exists.
4. **High — SECURITY DEFINER data disclosure risk.** Three original `calculate_*` functions in `001_core.sql` bypass RLS and lacked a caller business-ownership check. Added a *review-only* hardening migration `002_phase01_harden_calculations.sql` using invoker rights and membership checks. **Not executed**.
5. **High — broad member-write RLS.** `001_core.sql` lets any business member mutate products, orders and payments; fine-grained staff role permissions and transaction approvals are missing.
6. **High — financial dashboard is not accounting.** No chart of accounts, balanced journal postings, VAT rule source catalogue, immutable posting history, reconciliations, returns or statutory reporting engine exists.
7. **High — tax is a mock input.** Settings has only generic tax-mode selection. There is no actual Nigerian statutory classification, zero-rate vs exempt distinction, effective-dated law or item-level tax assignment.
8. **High — demo save messaging.** Business settings changes are local UI state only; no validated persistence.
9. **Medium — declared lint script incompatible.** `next lint` is no longer a supported Next.js 16 CLI invocation. Replaced with `tsc --noEmit` as a temporary validation shortcut; full ESLint setup remains TODO.
10. **Medium — Button component type mismatch.** The `style` prop was in its type but destructuring omitted it, resulting in an undefined reference. Fixed.
11. **Medium — grossProfit incorrectly included tax.** `orderTotals` counted VAT/tax as revenue in gross profit. Fixed grossProfit to exclude output tax. This helper is still not a certified accounting calculation and must be replaced by a decimal-safe ledger domain.
12. **Medium — no integrated test pipeline.** No test runner, lockfile, CI or reproducible successful build evidenced by the uploaded ZIPs.
13. **Medium — branding hardcoded.** `BusinessOS` appears in components, titles and metadata. Requires Phase 02 centrally managed platform identity with protected publishing workflow.

## Security posture
- Supabase RLS policies exist in migration, but execution/verification in a live database has not been observed.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser or `NEXT_PUBLIC_*` variables.
- Do not expose real customer or financial records before server-side session checks and role-aware RLS are validated.

## Target architecture
Modular Next.js application with domains: platform, identity, organisation, catalog, CRM, orders, purchases, inventory, ledger, invoicing, tax, messaging, automations, reports, audit. PostgreSQL for durable transactional data; storage for documents; server-side tax/accounting operations; background queue for messaging. Start with one deployable codebase, stable module interfaces, shared business IDs, and isolated tax-rule library.

## Risks and priorities
P0: real authentication and protected workspace/admin routes; membership and role permissions; eliminate bypass RLS functions; stop treating mock data as real.
P1: persistent business management CRUD and transaction integrity; exact-money accounting ledger; source-based tax classification.
P2: centrally editable brand identity; UI improvements; invoice export; real communications integrations only after consent/provider configuration.

## Changes in this Phase 01 copy
- Fixed Button `style` property reference.
- Replaced deprecated lint command with `tsc --noEmit` (temporary).
- Disabled unguarded `/admin` by redirecting to login; removed Admin nav link.
- Corrected demo gross profit helper to exclude tax.
- Updated login disclaimer to explicitly identify the demo-only form.
- Drafted **unexecuted** controlled SQL migration to remove unauthorised access to balance functions.

## Phase 02 prerequisites
1. Configure genuine Supabase auth, server session checking, route guards and separate platform-super-admin RBAC.
2. Validate RLS and helper migration in staging with two independent businesses and account types.
3. Create global `platform_settings` with protected edit/review/publish permissions and safe read access for public branding.
4. Refactor hardcoded brand identifiers to configuration-based rendering without changing existing logo assets.
5. Add reproducible install, typecheck, test and build verification.

## Verification status
Static inspection: completed. Deployed connectivity, migration execution, authentication, UI browser tests, production build and tax rule validation: **not verified**. Do not deploy this prototype as a production financial application.
