# BusinessOS Phase 030K — Partial Goods Receipts & Supplier Records

## Scope and boundaries
This is the **first bounded part** of Advanced Inventory & Procurement. It implements partial purchase deliveries, receipt audit records, recorded supplier invoices, and manually confirmed supplier payments. It adds a simple minimum-stock restock planning panel. Existing physical stock counts and variance audit remain available under Inventory.

**Not yet included:** branch stock transfers, warehouse allocations, branch-aware POS checkout/returns, purchase-to-GL posting, supplier tax invoices/e-invoicing, formal accounts payable journals, inventory costing methods, automatic bank transfers, or automated reorder commitments. Do not use these figures as certified financial statements. A supplier bill is explicitly recorded from a received supplier invoice; a purchase draft or goods receipt alone is not a supplier debt.

### Prerequisites
1. Back up the database and source. Confirm migrations 001–037 have been applied in order.
2. Install `supabase/migrations/038_partial_purchase_receipts_supplier_bills.sql` **once in staging**. Do not drop or recreate the database.
3. Run `MD/VERIFY_SQL_038_READ_ONLY.sql` using the Supabase SQL Editor.
4. Deploy the source to Vercel Preview; run CI and the full Next.js build. Test roles and real transactions before any live rollout.

### How purchasing works
- Order created in Draft. Inventory remains unchanged.
- Each delivery creates a uniquely identified receipt with only physically inspected quantities; product.stock_quantity, inventory_movements, receipt lines and per-line cumulative received_quantity are saved in one database transaction.
- A partially filled order remains `partially_received`, with quantities available for another receipt. Only complete receipt changes status to `received`.
- Old orders with status `received` are backfilled as fully received, but historical receipt documents cannot be reconstructed. No historical inventory movement is added or duplicated by migration 038.
- Owners/managers can register a supplier bill from a purchase that has at least one receipt. A registered bill amount is entered from external evidence, not inferred from a purchase estimate. Manually confirmed payments use a request UUID and cannot exceed the outstanding bill amount. This does not initiate a payment.
- `inventory` + `purchasing` entitlements required for receiving. Supplier bill/payment records require `purchasing` and the owner/manager role, at both app and SQL levels. Writes happen only through security-definer SQL RPCs; table clients get SELECT-only with RLS.

### Staging acceptance cases (NOT YET EXECUTED)
- [ ] Owner creates purchase for products A(8), B(5). No stock changes until receipt.
- [ ] Inventory staff receives A(3), B(1); respective stock increases exactly once; PO becomes partially_received.
- [ ] Same receipt request UUID retried; no second stock movement or increment.
- [ ] Remaining A(5), B(4) received; status changes to received; no quantity left.
- [ ] Over-receipt, negative, zero, excessive-precision and duplicate product receipt rejected without side effects.
- [ ] Concurrent receipt from two accounts cannot receive more than ordered.
- [ ] Sales staff and unauthorised businesses cannot receive stock or read supplier bills.
- [ ] Owner registers a bill against received PO with original supplier reference; duplicate supplier invoice reference rejected.
- [ ] Owner records part payment, then final payment; overpayment and duplicate payment submissions rejected.
- [ ] Finance GL is not automatically posted; supplier payment does not initiate bank transfer.
- [ ] Previously received orders are not back-received, and historical stock remains unchanged.
- [ ] Client with no Inventory entitlement cannot receive goods despite purchasing entitlement.
- [ ] Product list and PO list at capped page sizes display incomplete-data warnings.
- [ ] iPhone/Android and desktop forms remain usable; run the full production TypeScript check.

### Branch stock limitation
Current `products.stock_quantity` stores a **company-wide** balance. POS, stock counts and returns also change that aggregate field. Even though `business_branches` exists, branch transfers must not be activated until every sale, receipt, adjustment, return and shift movement is branch-aware and branch ledger totals are reconciled with company-wide balances. This phase intentionally **does not expose unsafe branch transfers**.
