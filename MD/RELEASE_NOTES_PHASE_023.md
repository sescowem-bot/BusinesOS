# BusinessOS — Phase 023: System Owner Detection, Admin Navigation and Document Views

## What is included

Based on Phase 022 source, plus the Phase 021 Communications TypeScript fix. This release preserves current public website, CRM, finance, tax, CMS, permissions, notification and platform admin modules.

### System Owner access
- Reuses the existing `public.platform_admins` table, requiring a valid Supabase Auth session and `active = true` on the server before showing System Owner controls.
- Already signed-in Super Admin visiting `/login` is redirected to `/admin`. Business members go to `/dashboard`; onboarded users with no business are redirected to `/onboarding`.
- Adds a System Owner entry in the public website navbar (desktop and mobile) and dashboard navigation for active Platform Admins.
- Non-admin users see their own dashboard or onboarding call to action; they do not see Super Admin controls.
- `/admin` has two prominent choices: Manage Website (`/admin/website`) and Manage Businesses (`/admin/businesses`).
- `/admin/website` provides authenticated brand editing, public CMS, pricing, email templates and platform diagnostics links.
- `/admin/businesses` includes business directory, search, plan permission and upgrade approval links.
- This is UI navigation only; protected pages and existing server actions still perform the independent Supabase admin authorization check. Never rely on hidden buttons as security.

### Business operations
- Printable order statements: `/invoices/[id]`, based on the existing order, order_items, customers, business and payment records scoped to the signed-in business.
- Printable payment acknowledgements: `/payments/[id]`, scoped to the business and available only for completed recorded payments.
- Entry points from Invoices, Payments and individual Order screens.
- Does NOT claim to create sequential tax invoices, verify funds with banks, automatically reconcile payments or file taxes. Both documents explicitly disclose their scope.
- Print and Save PDF use the browser's print dialogue, not a separate PDF service.

## SQL / deployment dependencies
- **No new SQL migration for Phase 023.** Existing migrations 001–020 must be installed. The Phase 022 business detail and review section also requires SQL migration `021_admin_business_review.sql` from the previous release.
- Do not rerun earlier migrations to install this frontend/backend page update.
- Deploy to Vercel Preview first. Keep production on the existing release until smoke tests pass.
- Merge the package into repository root (not a nested folder). Verify the Phase 021 Communications searchParams fix is present.

## Test checklist for preview deployment
1. Anonymous visitor sees Login and Get Started, never a System Owner shortcut.
2. Authenticated non-admin business user sees Dashboard, not System Owner links; direct `/admin` and `/admin/website` are denied.
3. Authenticated admin with no business membership is redirected to `/admin` after login; website header shows System Owner.
4. Admin with business membership sees System Owner entry in business header and sidebar.
5. On `/admin`, the Website and Business buttons open correct protected sections.
6. Website branding edits persist, and public CMS settings continue to work.
7. Business directory loads real businesses, `/admin/upgrades` and `/admin/plan-access` remain accessible to admin only.
8. Order statements show a real customer's items, totals, completed payments and remaining balance; print layout works desktop and mobile.
9. Completed payments have printable acknowledgements; pending/failed/refunded payments do not.
10. Accessing a different business's order or payment by UUID returns not found; never leaks records.
11. Run `npm run check:routes`, `npm run check:phase21`, `npm run check:phase22`, `npm run check:phase23`, `npm run typecheck` and `npm run build`.

## Verification completed in artifact preparation
- Route audit: 50 unique routes, zero duplicates.
- Phase 021 calculation/tax/reporting tests passed.
- Phase 022 source and migration safety checks passed.
- Phase 023 source guard checks passed.
- TypeScript/TSX syntax parsing succeeded (130 sources); this is NOT a TypeScript typecheck.
- Full `npm run typecheck` / `npm run build` unavailable in this environment because npm dependencies are not cached and the package registry cannot be reached.
- Live Supabase, Vercel Preview and permission tests have NOT been run.

## Known gaps (future phases)
- True numbered tax invoices and fiscal receipts need separately designed invoice sequences and audit history.
- Full customer editing, refunds and reconciliation are still pending.
- Role and plan entitlement enforcement across every server action, RPC and RLS policy needs an audit.
- Full Resend/Supabase Auth email hook and active system delivery are not yet verified.
- Phase 022 business review SQL (021) must be applied before that review feature is used.
