# BusinessOS Phase 030H — Advanced reviewed POS pricing

## Status
Source implemented, tested with static regression and isolated arithmetic checks. **NOT live-proven.** SQL 034 has not been applied by this package. A full Next.js production build and real transaction integration tests remain mandatory.

## Additions
- The existing POS can choose whether catalogue selling prices are **VAT exclusive** or **VAT inclusive** for the entire transaction.
- A **pre-tax, fixed NGN discount** may be entered. The database distributes it across each line in proportion to the net pre-discount amount, including zero-rated lines, then recalculates VAT per line.
- The application previews the estimated discount, VAT and total; the trusted Supabase RPC recomputes all amounts from the current product prices, current approved dated tax assignments, locked stock and server-side business identity.
- For inclusive prices, the catalogue unit selling price is converted to an NGN **net unit price rounded to 2 decimals**. The saved order and commercial invoice display net item prices, pre-tax discount and VAT separately.
- New issued invoices snapshot the POS price basis. Historical issued invoices remain unchanged.
- Atomic database transaction writes the order, order lines, VAT evidence, recorded payment (if selected), stock movement, POS idempotency key and pricing audit context.
- Only businesses with reviewed VAT registration and one active approved tax treatment per item can use this advanced flow. The legacy non-reviewed checkout does **not** get advanced pricing/discount features.

## Installation (in order)
1. Back up the application and Supabase database. Confirm SQL **001 through 033** are installed and verified. Do not drop or recreate earlier tables.
2. Merge the release into a GitHub review branch and deploy a Vercel Preview build. **Do not activate checkout before the database migration and code are aligned.**
3. Apply **`supabase/migrations/034_reviewed_pos_price_modes_discounts.sql`** once in **staging**. It aborts when migration 033 is missing or 034 appears already installed.
4. Run **`MD/VERIFY_SQL_034_READ_ONLY.sql`** to inspect database objects and RLS.
5. With separate owner, sales, outsider and business accounts, run the scenarios below. Confirm both database totals and printed invoices, not only on-screen previews.
6. Promote to production only after the GitHub Actions and Vercel production build plus live Supabase tests pass.

## Test scenarios
| Scenario | Expected |
| --- | --- |
| Approved standard-rated item ₦107.50, inclusive | Net ₦100.00, VAT ₦7.50, total ₦107.50 |
| Same item, inclusive with ₦10.00 **pre-tax** discount | Net ₦100, discount ₦10, VAT ₦6.75, payable ₦96.75 |
| Mixed standard ₦107.50 inclusive + zero-rated ₦200, discount ₦30 | Net ₦300, discount ₦30, VAT ₦6.75, payable ₦276.75 |
| Same standard item, exclusive, no discount | Net ₦107.50, VAT ₦8.06, payable ₦115.56 |
| Discount equal to/exceeding net subtotal | Rejected, no order or stock movement |
| Item missing/ambiguous tax rule | Rejected, no records or stock movement |
| Foreign business/unauthorised role | Rejected by database function |
| Insufficient tracked stock | Transaction rolled back |
| Simultaneous attempts on same stock | Database row locks prevent overselling |
| Repeat same request UUID | Returns original order; no second sale/payment/stock movement |
| Invoice issued after a discounted transaction | Snapshot shows net unit prices, discount, VAT and pricing basis; VAT line sum equals order tax |
| Printed existing invoice from before SQL 034 | No change to its stored issuance snapshot |

## Deliberate restrictions
- **Delivery fees:** Not automatically added; delivery itself may require an independently approved tax treatment. Needs a later reviewed delivery charge/credit note workflow.
- **Mixed VAT-inclusive/exclusive prices within a single basket:** Not enabled; one documented mode applies to the entire checkout.
- **Discount method:** A discount is specified on the **net, pre-tax** amounts. In inclusive mode the final payable reduction may exceed the entered discount because the VAT also decreases. No percentage/line-specific or after-tax discounts yet.
- **Unverified tax registration:** BusinessOS does not infer that a business is exempt, zero-rated or required to remit VAT merely from its company name. Obtain professional tax review.
- **No new NRS validation**, tax filing, card settlement, refunds, gift cards, split payments or hardware integration.
- **Displayed preview is not a tax invoice**; all amounts are recalculated inside PostgreSQL.

## Free-first architecture
No mandatory payment provider, paid automation API, barcode scanner or POS machine. The server still requires appropriate Next.js hosting and a Supabase database. Provider free tiers have limits and may restrict commercial deployment.

## Release files
- `supabase/migrations/034_reviewed_pos_price_modes_discounts.sql`
- `lib/pos-pricing.ts`
- `app/(dashboard)/pos/actions.ts`
- `app/(dashboard)/pos/checkout-form.tsx`
- `app/(dashboard)/pos/page.tsx`
- `lib/invoice-document.ts`
- `app/(dashboard)/invoices/issued/[id]/page.tsx`
- `app/globals.css`
- `scripts/verify-phase30h.cjs`
- updated `scripts/verify-phase30g.cjs`, `package.json`, GitHub CI, this MD documentation and read-only checker.

## Suggested next milestone
Phase 030I: controlled returns, credit notes and cashier reconciliation, but only after real transaction tests of POS 031–034. Avoid automatic refunds, financial posting or changes to historical invoice snapshots without separately verified workflows.
