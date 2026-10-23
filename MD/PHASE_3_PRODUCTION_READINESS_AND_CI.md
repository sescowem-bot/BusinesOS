# BusinessOS Phase 3A — Billing and production release controls

## Purpose
Improve production financial safeguards and make GitHub Actions diagnostics actionable without introducing SQL changes or test transactions against the live bank/business records.

## GitHub Actions root cause
Run 39977656521 stopped inside the Phase 028 source regression script, which required hardcoded create-order and add-customer links. Phase 2 deliberately moved these links into `lib/dashboard-workflow.ts` to avoid showing unauthorised actions. A second legacy assertion expects the old record-table pagination to live in `components/business-records.tsx`; it is now delegated to `lib/record-table-view.ts`. The Phase 030N order regression must accept tenant-verified older customer selection.

The updated CI script runs every existing regression independently and prints a full PASS/FAIL summary. Build and typecheck are attempted after successful dependency installation even if another regression has failed, rather than concealing additional failures. **CI is green only if all jobs finish successfully.**

## Phase 3A financial fail-closed checks
- Subscription initiation refuses to proceed when the current subscription/plan/user database read fails.
- Provider amount is derived from a published database price using exact integer kobo (rejects fractional kobo rather than silently rounding).
- Provider verification treats subscription-payment database errors as pending, not a false "invalid reference" judgment.
- Customer plan checkout pauses if published feature details are unavailable, and owners see when payment-history lookup fails.
- Administration cannot review a pending upgrade with incomplete plan/business identity data.

## Not done
- This does not change or replay historical SQL 001–064.
- No production payment, plan activation or DB write has been performed for verification.
- VAT-inclusive POS calculation and SQL 064 acceptance remain open blockers.
- Tenant-isolation and end-to-end payment callbacks need disposable database tests and browser verification.
- The extra Vercel project `busines-os` was returning failure; `busines-oss` succeeded. Disconnect unwanted project manually, after verifying which production domain it owns.

## Phase 3 continuation
1. Enforce cash/billing idempotency and webhook signature replay tests in an isolated DB.
2. Complete system-owner role and subscription-limits audit.
3. Install privacy/retention operational dashboards, audit trails, and incident runbooks.
4. Integrate real-world payment and tenant isolation tests before closing the production gates.

Important: a successful GitHub push or Vercel deployment does NOT certify a financial system.
