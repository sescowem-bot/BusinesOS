# Phase 05: Sales, Orders & CRM

## Implemented in the source
- Real tenant-scoped customer list and customer creation form.
- Real order list, single-line order creation workflow, order details and payment history.
- Manual completed-payment recording with balance enforcement, no payment gateway.
- Migration `006_sales_crm.sql`: authenticated membership-checked RPCs, atomic order + item creation, sequential row locking on payment RPC and read-only RLS for orders, items and payments.
- Tax remains 0 pending verified classification; do not treat the order tax column as compliant VAT calculation.

## Important limitations
- Existing unrelated dashboard, invoices, quotes, expense and product screens may remain demo driven.
- Create order currently supports one free-text item per order. Multiple-item orders, product linkage, discounts per line, draft workflows, tax computation, returns, reversals, customer edits, supplier management and financial ledger postings are future work.
- Existing legacy RLS policies for business_customers allow members to edit links; a full security review must precede production deployment.
- Legacy direct write pathways and any service-role application code must be audited before using this on a live financial system. Avoid allowing manual direct edits to accounting-critical tables.
- RPCs store payment records, but do not verify that money reached the bank. Users are responsible for recording verified receipts.
- Customer list balance is an operating summary, not an accountant-certified receivables ledger.

## Deploy sequence
1. Back up database.
2. Apply migrations 001 through 005, then `006_sales_crm.sql` in an isolated environment first.
3. Install dependencies: `npm install` (or `npm ci` if lockfile exists and matches).
4. Run `npm run typecheck` and `npm run build`.
5. Test create customer, cross-business isolation, order with customer, payment, overpayment, duplicate submissions, race conditions and permissions.
6. Only after successful testing deploy to production.

## Security note
The migration revokes direct client writes to orders, order_items and payments by replacing permissive RLS policies with SELECT-only policies. Existing applications that relied on direct INSERT/UPDATE/DELETE to those tables will need to use the new server-validated RPCs. Do not apply blindly to a production installation that has other financial writers.
