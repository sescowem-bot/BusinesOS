# BusinessOS — Phase 030I: Controlled POS Returns, Refunds and Commercial Credit Notes

## Release identity
- Built on Phase 030H source (SQL through `034_reviewed_pos_price_modes_discounts.sql`).
- Additive database migration: `035_pos_returns_refunds_credit_notes.sql`.
- New routes: `/returns`, `/returns/[id]`, `/returns/credit-notes/[id]`.
- Existing sidebar POS and Orders menus now link to Returns; CI has `npm run check:phase30i`.
- No paid tool, gateway, or POS terminal required.

## What is implemented
1. A POS staff member (owner, manager or sales) requests a return for an existing POS sale item. Request ID prevents repeat submission of the same request. One pending/approved return per order item at a time.
2. The database verifies tenant membership, POS entitlement, ownership of the original POS order and sold item, fully recorded payment, supported tax evidence and remaining quantity. Unsupported orders fail safely.
3. Owner or manager separately approves/rejects. Managers cannot approve their own requests; a sole owner is explicitly allowed to approve their own request.
4. After actual refund outside the platform, owner/manager confirms refund method, external voucher/reference and returned goods disposition. **The database atomically** records the return completion, one manual refund record, one printable commercial credit note and optional saleable stock restoration with an inventory movement.
5. Credit amounts are apportioned from the **original POS item tax snapshot**, including pre-tax discounts and item VAT. Cumulative rounding makes successive partial returns add up to the original item credit down to the cent. Original orders, positive payments and original commercial invoices are never rewritten.
6. Credit note stores seller/customer identity and VAT-at-sale evidence as an issuance snapshot. It can be printed / saved as PDF in the browser.

## Explicit first-release boundaries
- Only **fully paid POS orders**, NGN currency, with **no delivery charges** are eligible. Unpaid/non-POS/manual orders, payment disputes, exchanges, refunding shipping, non-NGN orders and advanced mixed-price edge cases require their own reviewed workflows.
- Returning a product does not automatically initiate any bank/card/terminal refund. The operator attests that an external refund was performed. This application cannot independently verify the bank's settlement.
- For restocking, the item must still exist and be inventory-tracked, and the manager must explicitly mark it saleable; unsaleable returns never increase available stock.
- Credit notes are commercial records, **not** NRS-validated tax documents or automated amended tax filings.
- **Existing accounting, gross-sales and VAT reports do not automatically net these credits.** Finance must reconcile these separately. The next phase must extend receivables, tax and GL reporting with validated reversal postings; do not double-post manual adjustments.
- No customer automated email, approval bypass or dedicated refund payment gateway.

## Migration and installation
1. **Do not deploy directly to production.** Back up both Supabase and GitHub.
2. Confirm migrations 001–034 are correctly installed; SQL 035 checks for 034 prerequisites and refuses a repeat/partial installation.
3. Apply SQL 035 to a **staging clone** and then run `MD/VERIFY_SQL_035_READ_ONLY.sql`.
4. Check Supabase role grants, SQL functions, RLS and cross-business rejection with at least two independently registered businesses. Require a POS entitlement for both access and calling functions.
5. Merge changed files or the full source into a review branch; build on Vercel Preview.
6. Open `/returns` on an authenticated business workspace. Create a paid POS sale in staging; request a partial return; approve using appropriate identity; confirm a **test-only** external refund and restocking; inspect the printed credit note and inventory movement.
7. Complete every case in `MD/PHASE_030I_ACCEPTANCE.md`. Never test refunds with real money without appropriate approval.
8. Promote only after clean `npm run typecheck`, `npm run build`, and live transactional tests. Neither a full build nor live Supabase integration has been certified in the isolated development environment.

## Privilege separation
- SQL SECURITY DEFINER functions validate `auth.uid()`, business membership and business POS entitlements, and use explicit owner/manager/sales checks.
- Tables expose SELECT only via business-feature RLS. No client-side INSERT/UPDATE/DELETE permissions are granted.
- Financial mutations run inside a PostgreSQL transaction; if a statement fails, the refund, credit note, status update and stock restoration roll back together.
- A POS sales member can only request; a manager cannot approve their own request. Only owners/managers can confirm settlement.

## Next integration priority
Cashier reconciliation and financial net-return reporting: credit notes, bank/refund vouchers, accounting journal reversals and VAT reporting must be integrated and tested rather than inferred from the original gross sales reports.
