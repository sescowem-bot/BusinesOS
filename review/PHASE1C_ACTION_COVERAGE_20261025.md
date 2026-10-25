# Phase 1C — BusinessOS application-level action coverage
**Date:** 25 October 2026
**Scope:** All changes are TypeScript/React source; no SQL, charges, subscriptions or existing business records are mutated.

## Implemented in source
- Added a server-only `premiumActionAllowed` helper. It calls `business_can_perform_action` for the currently authenticated business and checks the boolean strictly. Failed database reads deny the write. The existing premium feature and legacy staff role checks remain in place.
- Applied checks before the selected POS checkout, held-cart, cash-shift, return-request/review/refund-record, and product tax-mapping RPCs.
- Applied purchasing checks for suppliers, orders, goods receipt (requires both purchasing and inventory), supplier bill and supplier payment recording.
- Applied inventory edit controls to location activation, stock transfer, location physical counts, ordinary stock adjustments and counts.
- Applied accounting controls to account and period creation, journal posting, integration configuration, source discovery and journal batch processing.
- Closed the separate reviewed-VAT order action gap by verifying Orders:Create and Payments:Create for initial part payments.
- Core Products:Create now checked in catalogue creation and form navigation; tracked-stock creation separately needs Inventory:Create.
- The System Owner action page now reads and clearly displays the live global enforcement flag, rather than suggesting saved action decisions are currently enforced.

## Explicit limitations
- The global action matrix flag remains OFF and existing role restrictions apply; once activated, the new guards respect explicit action denies, but the action registry is NOT yet fully enforced inside PostgreSQL transactions.
- Authenticated clients can still bypass a Next.js server action by calling some exposed SECURITY DEFINER RPCs directly. The reviewed, unapplied Phase 1B SQL is in `review/sql` and does not solve all POS/inventory/refund/accounting RPC bypasses.
- This release does not alter tax mathematics, Paystack, subscription activation, row policies or numerical quota flags.
- The source tests validate coverage/ordering of helper calls, not cross-tenant runtime authorization. Multi-tenant regression and payment/stock concurrency acceptance remain before any claim of financial-grade security.

## Next release gates
1. Review compatibility and formally install the atomic Phase 1B database migration with rollback/restore readiness.
2. Apply transaction-local permission guards in the remaining authoritative RPCs with explicit tenant and staff restrictions and RLS/privilege audit.
3. Verify every plan's saved Allow/Deny behaviour, especially Free and expired plans, against signed-in, role-specific accounts, including direct REST and direct RPC attempts.
4. Enable global action/usage enforcement only after both independent testing and owner sign-off.
