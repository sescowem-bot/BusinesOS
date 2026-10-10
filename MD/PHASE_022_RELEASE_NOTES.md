# BusinessOS Phase 022 — Super Admin Business Review and CMS Editing

Built on the **Phase 021.1 communications searchParams fixed source**. This ZIP contains the complete source at the repository root, not a demo or standalone page.

## Delivered

- `app/admin/businesses/page.tsx`: search by business name / category; links to details; reads the existing `platform_business_directory()` RPC and shows accurate database states.
- `app/admin/businesses/[id]/page.tsx`: secure business overview, member role directory, assigned plan, pending upgrades, public listing state and internal review history.
- `app/admin/businesses/[id]/review-form.tsx` and `actions.ts`: status and note editor with Supabase RPC and validation. Notes are **private administrative workflow notes** and **do not suspend or restrict accounts**.
- `supabase/migrations/021_admin_business_review.sql`: two additive tables (`platform_business_review_notes`, `platform_business_review_audit`), strict RLS with no direct user grants, and two SECURITY DEFINER functions checking `platform_admins.active`. Audit history records status changes and does not expose business customer transactions.
- `app/admin/cms-form.tsx`: human-readable fields for page sections, with add/remove controls, limits and published toggle. Eliminates the manual JSON editing requirement.
- `app/admin/content/page.tsx`: fails closed on CMS database read errors, rather than presenting fallback content as if it were saved records.
- `app/admin/cms-actions.ts`: rejects null / malformed / empty CMS sections.
- Existing pricing plan IDs are shown as read-only in the editor to reduce accidental changes to identifiers referenced by approved plans.
- System Owner dashboard links and notes updated.

## Apply SQL separately and safely

`supabase/migrations/021_admin_business_review.sql` must run **AFTER successful migration 020**. This is a *new* migration required only for the new business detail/review page; do not rerun 001–020. Back up the Supabase database, apply it in a staging project first, and then deploy the code to a Vercel preview environment.

The release contains **no Resend Auth Hook switch**, no email delivery activation, no user account suspension, no impersonation and no destructive account deletion. The existing auth and business functions remain intact.

## Installation

1. Confirm the Phase 021.1 communications build fix has been committed. Compare your GitHub `main` with this archive to avoid overwriting newer changes.
2. Back up GitHub and Supabase.
3. In Supabase staging: run only `supabase/migrations/021_admin_business_review.sql` after checking 001–020.
4. Copy the extracted project contents **directly into the GitHub repository root**, not a nested folder; review the diff before committing.
5. On a machine with registry access: `npm install`, commit `package-lock.json`, then `npm ci && npm run check:routes && npm run check:phase21 && npm run check:phase22 && npm run typecheck && npm run build`.
6. Deploy first to a Vercel preview. Check `/admin`, `/admin/businesses`, `/admin/businesses/<real-uuid>` and `/admin/content`.
7. Only promote after a clean build and completing the checks below.

## Verification completed locally

- `npm run check:routes`: **47 routes, no duplicates**.
- `npm run check:phase21`: **123 TS/TSX source files parsed**, calculation, tax and reporting pure-logic tests passed.
- `npm run check:phase22`: **123 TS/TSX source files parsed**, additive migration access-control text checks passed.
- ZIP integrity to be checked after packaging.

**Not verified:** full Next.js production build, `tsc --noEmit`, live Supabase RLS behavior, user journeys, responsive rendering and migration execution on your production database. Dependency installation timed out in this environment. Do not describe this as production-tested.

## Acceptance tests

- Sign in as a Platform Admin; directory loads actual records and search filters correctly.
- Open a real business detail, confirm membership roles, plan and contact info are accurate.
- Add an internal review note, change review status, reload, and confirm note and audit entry persist.
- Sign in as a **normal business owner** and attempt the detail RPC and note RPC using their session: both MUST return `42501`; no customer/other-business data is exposed.
- Verify anonymous visitors cannot read `platform_business_review_notes` or its audit table directly via PostgREST.
- Update a public CMS page section without writing JSON; add and remove sections; ensure public page updates after save. Check a previously published page and an unpublished page.
- Edit an existing pricing card and verify an already approved business plan still references the same ID.
- Repeat the upgrade approval flow from Phase 021. Confirm the previous `/communications` build fix remains effective.

## Not included yet

- Platform-wide user invitation or deactivation, suspension enforcement, impersonation, rich media uploads, complete visual layout designer, PDF invoices, automated financial posting, and live Resend Auth Hooks. These are separate audited milestones.
