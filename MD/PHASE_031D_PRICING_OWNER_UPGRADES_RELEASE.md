# BusinessOS Subscription & Owner Upgrade — Release Checklist
2026-10-19 | Review branch: feature/pricing-owner-upgrades-20261019

## Changes made
1. Existing plan editor now saves monthly/yearly NGN prices alongside plan descriptions instead of silently ignoring them. The separate quick price form is still available for quick edits.
2. Business Settings displays a Plan & Subscription card ONLY to the business owner, linking to /upgrade with current plan and request status.
3. /upgrade shows an owner-only upgrade-request form beside available checkout choices, preserves the existing verified Paystack payment flow, and shows pending/reviewed requests. Sending a request never charges a card.
4. /admin/upgrades serves a current request queue. The administrator must provide a response. Accept/decline is a review decision, not proof of payment.
5. SQL 053 changes review_business_upgrade to STOP silently assigning/activating subscriptions on approval. Only verified Paystack checkout or separately authorised and audited complimentary assignment may activate paid access.
6. /admin/health shows whether price columns, plan-parent table, and admin-only diagnostics RPC are ready, plus plan/request counts when SQL 053 is installed.
7. Plan inheritance server action now reports diagnostic database error codes to the System Owner and distinguishes missing RPC/table, permission, plan deleted, and hierarchy errors.
8. Global loader uses the brand already present in the layout; slower pages show concise recovery actions. Cookie notice is confined to public/auth pages instead of obstructing the management console.
9. The platform brand name is sourced from Brand Studio; this upgrade does not overwrite any user's configured brand.

## Database requirements — DO NOT blindly re-run earlier SQL scripts
- Back up existing Supabase production database, retain a recovery snapshot, and verify that migrations 001–052 were *actually* run and in the correct order.
- **SQL 053 is new and must be applied ONCE in staging before deployment.** It does NOT change existing subscription rows, pricing, or payments.
- Test a staging merchant owner upgrade request, verify other merchants cannot submit for that company, and verify staff cannot request the upgrade.
- Test the admin Accept request decision: status becomes approved, but paid plan assignment MUST NOT change.
- Test the audited manual assignment separately and ONLY with clear authorised reasoning; verify it records changes in business_admin_plan_audit.
- Test Paystack payment verification and plan activation independently. Do not use production payment credentials in a test environment.
- Validate pricing creation/editing, publication status and cache invalidation.
- Test plan parent inheritance: if SQL 029 RPC is missing, inspect and repair the migration state — never re-run 029 blindly. SQL 053 diagnostics shows table and function presence once installed.
- SQL 053 acceptance: SELECT on unrelated business_upgrade_requests is blocked by RLS; status changes cannot be performed by ordinary business owners.
- If SQL 051 or 052 remains uninstalled, complete its own staging checks first; SQL 053 requires legal_document_versions from 051 (not a blanket promise of legal compliance).

## Operational checks before production
- npm run check:routes
- npx tsc --noEmit
- npm run build
- GitHub Actions checks and Vercel preview are green
- Mobile + desktop owner Settings and /upgrade verified with one owner and one staff login.
- Plans: create draft, set prices, publish, edit existing price, refresh public pricing page, run parent linking, verify duplicate/invalid cycles are rejected.
- /admin/upgrades: accept & decline workflows; verify no automatic paid upgrade from request review.
- /admin/health: diagnostics fail gracefully when not yet installed, with no customer-facing SQL instructions.
- Performance: global loading recovery is not proof latency is repaired. Capture real Vercel function logs and Supabase query timings before asserting the 10-second stall root cause.
- Check cookie inventory: only strictly necessary cookies are described as active. Consent for future optional trackers is a separate feature.

## Known limitations
- Real Vercel runtime errors could not be queried through the current connector because the project returned HTTP 403. Obtain Vercel logs using an authorised account and redact secrets before sharing.
- The branch cannot inspect Supabase's actual migration state or perform staging database tests without database access.
- Pricing changes do not charge or refund customers or automatically recalculate existing billing periods.
- Full legal documents still require operator facts and qualified review.
- No production deployment, database schema changes, or checkout charge is made by this branch.
