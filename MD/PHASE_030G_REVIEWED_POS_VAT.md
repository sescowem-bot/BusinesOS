# Phase 030G — Tax-aware multi-item POS checkout and invoice evidence

## Scope and safety

This upgrade extends Phase 030F's *reviewed* VAT calculation from a single-item order to software POS baskets containing multiple products with different approved VAT treatments. It is **not** automatic tax-law classification, a tax filing engine, payment processing, statutory NRS e-invoicing or a guarantee of legal compliance.

**Existing issued invoices and orders are untouched.** Migration `033_pos_reviewed_vat_mixed_baskets.sql` is additive except for hardening the existing `business_pos_checkout` function. It refuses legacy untaxed POS for businesses marked `vat_registration_status='registered'`, regardless of their review status. Registered businesses with `classification_status='reviewed'` instead use the new `business_pos_checkout_reviewed` function. Others can continue the legacy, explicitly *unverified tax* checkout, subject to independent tax review.

### New functionality

- `/pos/tax-mapping`: business Owner or Manager maps existing products to existing supply categories. Mapping never approves the underlying classification.
- `/pos`: reviewed VAT-registered businesses see approved VAT estimates per checkout and cannot check out products missing a single current, approved tax assignment.
- Server-side POS transaction: locks current product prices/stock, checks today's date in **Africa/Lagos**, validates one approved dated rule per mapped supply, totals VAT per line, creates order, order items, POS tax evidence, any recorded payment and inventory stock movements **atomically**.
- Security: business ownership, POS feature entitlement and permitted member roles are validated inside the database. A reused checkout request ID is guarded by a transaction-scoped advisory lock and returns the original order ID without double-debiting stock.
- Newly issued invoices capture itemised `pos_tax_lines` with legal rule IDs, date, taxable base, treatment and amount, and show a printable VAT breakdown. Invoice snapshot VAT must reconcile to stored order tax.
- Current release: **NGN, VAT-exclusive prices, no POS discounts or delivery fees**; supports mixed standard, zero-rated, exempt, and outside-scope classified products. Standard rate requires reviewed approved rule with **7.5%**. Zero/exempt/outside scope use 0% but retain distinct labels.

### Installation order

1. Back up the database and GitHub code.
2. Confirm migrations **001–032** are installed, especially 031 (POS) and 032 (invoice/tax). Do **not** rerun earlier migrations.
3. Merge the source in a *review branch*, run GitHub CI and build a Vercel Preview deployment. This package has not been production-build or live-database verified here.
4. Apply `supabase/migrations/033_pos_reviewed_vat_mixed_baskets.sql` to a **staging database**. The file uses a transaction, but failure still needs investigation; do not simply rerun after an unknown state.
5. Execute `MD/VERIFY_SQL_033_READ_ONLY.sql` in SQL Editor to verify table/RLS/function/trigger presence.
6. Using test accounts, configure an existing VAT-registered and reviewed business. Ensure the supply categories are tied to trusted **approved** tax-law rules and approved business assignments (the app never auto-approves them).
7. Visit `/pos/tax-mapping` as owner/manager and link products to their approved supply categories; the product's own business must match the category's business.
8. In `/pos`, create a *test* sale containing a standard-rated item plus zero-rated item. Confirm total = subtotal + calculated VAT, payment total matches, and inventory decreases once; issue the invoice and verify the printed VAT breakdown.
9. Verify rejected scenarios below. Keep a test business only and **do not activate broad commercial POS until acceptance tests pass**.

### Staging acceptance matrix

| Test | Required outcome |
|---|---|
| Reviewed standard-rated item (₦5,000 VAT-exclusive) | ₦375 VAT and ₦5,375 total at 7.5% |
| Mix ₦1,000 standard + ₦200 zero-rated | ₦75 VAT and ₦1,275 total; distinct item treatment recorded |
| Mix zero-rated and exempt | ₦0 VAT, but correct distinct labels in invoice |
| Product with no supply mapping | Reject without order, payment or stock movement |
| No rule, expired rule, future rule or two overlapping approved rules | Reject entire checkout |
| Tax profile registered but not reviewed | Block POS, including direct legacy RPC call |
| Checkout with foreign business product/customer | Reject entire checkout |
| Two cashiers selling last tracked unit | Only one sale can deduct final unit |
| Reuse request ID concurrently | One sale; repeated call gets same order ID |
| Unpaid reviewed sale | Correct tax/order/stock, no payment entry |
| Paid reviewed sale | Payment equals VAT-inclusive total; no card/bank debit attempted |
| Staff without POS permission | Reject via UI and SQL |
| Map foreign business supply/product | Reject even if calling RPC directly |
| Issue invoice after reviewed POS sale | Itemised VAT captured in issuance snapshot and immutable |
| Old invoice issued before SQL 033 | Exactly same totals and snapshot |
| Revoke POS access | Checkout RPC refuses subsequent transactions |

### Important limitations and future work

- The app's tax profile and approved rule workflow require qualified review. The mapping form intentionally cannot create or approve legal rules. No tax amount should be inferred from product names, SKUs or categories without trusted approval.
- Tax should be recalculated/confirmed at the moment of checkout; the browser preview is indicative only.
- VAT-inclusive price decomposition, delivery fees, mixed-line discounts, returns/refunds, tax credit notes and the reconciliation ledger are not implemented in this release.
- The POS still loads up to 500 active products. Server-side search/pagination and branch-specific stock will be needed for larger catalogues.
- External card/transfer methods record manually confirmed payments; they do not process or verify settlements.
- Supabase/Vercel free-tier limitations and production/commercial hosting terms still apply.
- If rule/policy changes require other VAT rates or legal exceptions, the fail-closed constraints must be reviewed and updated; **do not bypass the approval checks**.

### Commands

```sh
npm run check:routes
npm run check:phase30f
npm run check:phase30g
npm run typecheck
npm run build
```

The last two commands need the installed Node dependencies. Passing source checks is not the same as passing a full build or running PostgreSQL integration tests.
