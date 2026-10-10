# BusinessOS Phase 030M-C — Professional Dashboard, Profit Evidence, Support and Role Controls

## Scope and release rules

This release addresses real reviewer feedback that the workspace dashboard was too basic, hid order payment status and didn't display profit. It also adds a way for the Platform Owner to assist customers and for business owners to manage and request existing team roles.

**Speed first:** Business dashboard metrics are now returned via a single PostgreSQL `business_dashboard_command` RPC, using indexes already provided by previous migrations, rather than downloading up to 5,000 orders, 10,000 payments, thousands of expenses and product records on each request. The RPC returns exact aggregates and the latest **eight** orders, not complete transaction lists. The server-only dashboard includes a route-loading skeleton; there is no heavyweight client chart library or artificial demo data. Load testing and `EXPLAIN (ANALYZE, BUFFERS)` on a staging-sized dataset are mandatory before production.

**Requires migration 042 after migration 041.** Do not deploy the changed dashboard or order-creation code against a database missing migration 042. The migration is additive and must be applied **once in staging first** after a backup. No old orders, historical cost figures, payments, invoices, posted accounting journals, or roles are changed by running SQL 042.

## Business dashboard (`/dashboard`)

- Professional overview with sales, received payments, actual customer outstanding, expenses (finance-authorised staff only), estimated gross profit, overdue order count and low-stock priorities.
- Recent order control table: order number, original value, received amount, balance due, payment status and direct order details.
- Sales/collection period trends derived from recorded current/prior month totals, Africa/Lagos date convention.
- Profit: combines **estimated POS item margin** based on originally recorded POS unit costs and completed returns with **manual sales supported by explicit unit-cost evidence**. Historical manual orders without cost evidence are excluded; the coverage count is displayed. The number is **not net business profit** and excludes overhead, non-posted adjustments, tax provision, wages and other unsupported financial entries.
- Financial Reporting feature access plus owner/manager/finance role is required to see gross-profit estimates. Platform Administrator rights **do not bypass** normal business memberships/financial entitlements. Generic staff do not receive dashboard financial amounts; sales roles cannot receive expense/profit details.
- Exact outstanding balances derive from completed payment rows for valid, non-cancelled orders, not a manually editable `paid` switch. Performance must be checked against real dataset sizes.

## Order costing (`/orders/new`, `/orders/[id]`)

- Owner/manager/finance can optionally record *verified item cost per unit* during ordinary or VAT-reviewed order creation. Sales staff cannot enter or read this cost evidence through the new interface.
- The new `crm_create_order_with_cost` database RPC wraps SQL 036's original **atomic** order+initial-payment creation in the same database transaction, then adds internal cost evidence for a single-item order. Reusing an idempotency key with different recorded cost is rejected.
- Historical single-item manual orders missing cost evidence can be filled *once* through their order-detail page by authorised owner/manager/finance roles using `business_record_missing_order_cost`.
- Costs are an internal estimate and **not a supplier invoice, a proof of payment or a journal entry**. The cost adjustment does not change customer charges, issued invoice totals, payment records or reported VAT.
- Never enter zero to mean unknown cost. Zero is valid only if the item's actual evidenced incremental cost is zero.

## Platform support and staff roles

- `/support`: business members can open support requests and see their own requests. Owners can request a role change for a **specific existing non-owner** member. Neither support requests nor role changes require sharing the customer's password.
- `/admin/support`: Platform Admin sees the most recent 80 support requests, can answer/decline general requests and can apply only the **specific** existing-member role change explicitly requested by a current business owner. Re-checks consent and membership inside SQL, atomically, with an audit row. No impersonation or silent owner promotion.
- `/team`: business owners can assign existing staff to one of `manager`, `sales`, `inventory`, `finance`, `staff` via an auditable SQL function. Business owners may still invite a new staff member. `owner` and `platform admin` roles are not granted or transferred through this workflow.
- The existing system-owner feature grant and plan role permission modules remain unchanged. A new staff role does not override the business's plan or module restrictions.
- Only protected SECURITY DEFINER functions can mutate the new support, role-audit and cost-evidence tables; ordinary authenticated users have RLS-restricted **read-only** table privileges.

## Installation checklist

1. Back up Supabase data and save a copy of your working GitHub branch.
2. Confirm SQL migrations **001–041** are installed and tested. Do not skip SQL 040 or 041. The order-cost functions rely on SQL 036 and the margin relies on SQL 041.
3. Apply `supabase/migrations/042_dashboard_support_roles.sql` **once** in **staging** using Supabase SQL Editor. Its transaction aborts on missing prerequisites.
4. Run `MD/VERIFY_SQL_042_READ_ONLY.sql`; inspect that every new table has RLS on, **SELECT-only** for authenticated users, and admin/RPC grants are correct. Compare row counts before and after.
5. Deploy matching code to a Vercel **Preview** branch. Do **not** overwrite older production code without checking the branch differences.
6. Run `npm ci`, `npm run typecheck`, `npm run build`, `npm run check:routes`, `npm run check:dashboard-support`, and the full CI regression suite. The inherited source archive has **no lockfile** and a reproducible installation/build has not yet been verified.
7. Test `MD/PHASE_030M_C_ACCEPTANCE.md` with a company owner, finance user, sales user, staff user, separate company and Platform Admin.
8. Capture before/after Web Vitals on mobile and test the database report at realistic scale. Do not enable in production without performance and security passing.

## Speed and scale caveats

The RPC avoids large response payloads and reuses period/lookup indexes, but computing exact outstanding balances requires database aggregation over valid historical orders. For very large companies this may need an incremental per-order balance table or dedicated reporting materialization. Do not cache or share financial data publicly. Check slow queries, indexed plans, memory and supabase connection limits before rollout.
