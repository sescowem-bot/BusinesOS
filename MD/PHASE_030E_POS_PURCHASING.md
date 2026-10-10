# Phase 030E | Software POS, Suppliers & Purchasing

## What has been implemented
- `/pos`: multi-item retail checkout from existing products/services, optional walk-in/customer, full payment recorded manually or an unpaid order; printable existing order/statement.
- `/purchasing`: suppliers, costed multi-item **draft** purchase orders, line review, explicit goods receipt, stock movement history.
- SQL `031_pos_supplier_purchasing.sql`: four authenticated business-scoped write RPCs, four new RLS-read-only tables, new `pos` / `purchasing` subscription feature flags, and updates to admin plan/role/business-grant functions.
- Existing orders, order_items, payments, products and inventory_movements are reused. A sale and stock deduction are one database transaction. Goods receipt only happens when confirmed, at most once.
- Mobile layouts and navigation are included in the workspace.

## Billing and limitations
No bank card is charged, no POS hardware is integrated, no gateway is required, and no payment or supplier invoice is automatically settled. Selecting Cash, Transfer, or POS **only records a manually verified payment**. Purchase drafts do not create supplier liabilities or accounting journals. Receipt does not automatically reconcile account balances, recalculate cost price, create tax invoices or update financial ledgers. POS checkout currently accepts full recorded payment or no initial payment; later payments use the existing Order screen. Sales returns, exchanges, refunds, cash drawer reconciliation, multi-location stock allocations and barcode hardware are future work.

## Permissions
`pos`: owner, manager, sales by default; `purchasing`: owner, manager, inventory by default. Each feature is separately configured and must be enabled in the business's plan, inherited from a lower plan, or explicitly granted by System Owner. The SQL function enforces BOTH feature and membership role. Goods receipt additionally requires inventory feature access. A POS grant allows stock decrement for checkout **without** permitting manual inventory adjustment.

New features are **disabled by default** for all existing plans/businesses, so no customer is upgraded automatically. Use `/admin/plan-access` to enable features for a plan and roles, or `/admin/businesses/[id]` to grant to one business (SQL 031 first). You may include POS and Purchasing in Growth, Professional and Enterprise through the plan inheritance settings. This migration does not set subscription prices.

## Installation / rollout
1. Use the corrected Phase 030D source as base. Confirm migrations **001–030**, including 029 cumulative plans and 030 automation execution, have succeeded. Back up Supabase.
2. Apply `supabase/migrations/031_pos_supplier_purchasing.sql` **ONCE** in a staging Supabase project. SQL runs in a single transaction. Do not run it twice, drop tables or overwrite unrelated schema.
3. Run `MD/VERIFY_SQL_031_READ_ONLY.sql` and ensure table, RLS and function checks pass. Test permissions as separate users from two businesses.
4. Merge the Phase 030E patch on a GitHub branch and deploy Vercel Preview. Run `npm run check:phase30e`, `npm run typecheck` and `npm run build` in GitHub Actions.
5. In Super Admin, enable `pos` and `purchasing` for chosen plans or grant them to a pilot business. Receiving stock also needs `inventory`. Check the correct roles.
6. Create tracked products and a supplier. Make a draft purchase; ensure stock is unchanged. Receive it; ensure stock increases once and `purchase` movement exists. Retry receipt; it must fail without additional stock.
7. Sell two products in POS; verify one order with the correct lines, optional completed payment, matching stock deductions and `sale` movements. Sell with insufficient stock; the entire attempt must roll back. Confirm cross-business products/customers cannot be used.
8. Submit the same `request_id` twice; verify only one order is recorded. Run concurrent checkout stress tests on the same low-stock item; stock must never go negative.
9. Verify that staff without `pos` cannot check out, staff without `purchasing` cannot create purchase orders, and a purchasing role without `inventory` cannot receive goods. Verify branchless mobile and 320px displays.
10. Validate customer statements and financial reports, considering POS payments and stock receipt. Do not launch until transactions and role isolation have passed real database tests.

## Important verification boundaries
Source tests are static checks. Local Next.js dependencies were unavailable, so a complete production build, browser rendering and database concurrency tests were **not** performed during packaging. SQL is provided as a migration, **not** applied to your production Supabase. No GitHub push, deployment or activation was performed.

## Operational safeguards
- SQL takes row locks on product stock; insufficient-stock sales fail atomically.
- `business_pos_sales` has a unique `(business_id, request_id)` key to limit duplicate checkout retries.
- All write RPCs use `auth.uid()`, assigned business memberships, and business-specific feature checks; direct writes are revoked.
- Stock receipts use row-locking on the purchase order and change status from `draft` to `received` exactly once.
- Access to supplier contact data is protected by RLS.
- Pages label capped datasets instead of claiming all-time sales or inventory totals.
