# Order creation: payment status in one screen (SQL 036)

## Why this patch exists

Before this patch, the user created an order, navigated to its detail page, and separately recorded the initial payment. This confused early reviewers and made the payment status hard to find. The new `/orders/new` form asks **Not paid**, **Part payment**, or **Paid in full** and saves the order plus initial payment **atomically**.

## Source and migration

- Apply migration `supabase/migrations/036_order_creation_initial_payment.sql` **only after** migration 035, initially in a staging database. Do not reset your existing data or rerun migration 035.
- Deploy the matching source files (including `components/order-initial-payment.tsx`) to Vercel Preview. No new paid service or environment variable is needed.
- The new server actions `createOrder` and `createReviewedTaxOrder` both invoke `crm_create_order_with_initial_payment`. Do **not** enable the new application release against a database missing SQL 036.
- View and confirm the migration through `MD/VERIFY_SQL_036_READ_ONLY.sql`.
- The migration creates a private idempotency-key table and a `SECURITY DEFINER` RPC with explicit business membership and sales-role validation. It calls existing vetted order functions. The order creation, any payment insert, and idempotency token commit or roll back together.
- No historical invoices, VAT snapshots, orders or payments are updated.

## User flow

1. Navigate to `/orders/new`, select the customer, supply, quantity and price.
2. Choose **Not paid**, **Part payment** (enter amount), or **Paid in full**. For a recorded payment, enter method and optional reference. Payment methods are **records of payment received**; no card charge or transfer is initiated.
3. Review preview figures. For reviewed-VAT orders, the server and database recalculate the legally reviewed taxable total; the preview is **not** an authoritative tax assessment.
4. Save. The action redirects directly to the saved order, where the payment state, amount received and remaining balance are visible. Staff can record later instalments without changing the initial payment.
5. Repeat-clicking/retrying the same request key returns the same order instead of creating another order or payment. If form inputs are changed with the same key, the database refuses re-use rather than quietly accepting different data.

## Boundaries

- The existing standard order flow is intentionally unavailable for businesses with an approved VAT-registered profile; those businesses must use the reviewed-tax order section. SQL 036 preserves these checks.
- Full payment is **calculated from the saved order total by PostgreSQL**, including approved VAT, not trusted to a browser number. Partial payments must be strictly between zero and the actual total, rounded to two decimal places.
- Total zero may only be saved with **Not paid**, and the order summary labels it **No payment due**.
- Cash, verified transfer, external POS, recorded card and other are bookkeeping methods. The system **does not confirm external bank transactions**. Staff must verify receipts before marking them paid.
- The payment-status label is *derived* from completed payment rows, not a manually editable database flag. Order fulfilment status is separate.
- Existing POS checkout and return/refund records were not altered. Tax-inclusive invoices, refunds, financial reconciliation and statutory tax reporting still require end-to-end tests.

## Acceptance checklist for staging

- [ ] SQL 036 installs cleanly after 035; the read-only checker shows expected entries.
- [ ] Owner, manager, finance and sales can create a permitted order and initial payment. Unauthorised staff cannot call the RPC.
- [ ] Create an unpaid order; verify one order, zero payments and full outstanding balance.
- [ ] Create a part-paid order; verify one completed payment, accurate outstanding balance and selected method/reference.
- [ ] Create a fully paid order; verify exact total received and zero outstanding.
- [ ] Repeat each test with an approved reviewed-VAT supply. Test 7.5%, exempt and zero-rated supplies.
- [ ] Attempt a partial amount greater than or equal to the final total. Verify **neither order nor payment** is created.
- [ ] Attempt negative, zero and overprecision partial amounts. Verify rejection.
- [ ] Create the same request twice simultaneously. Verify only one order and payment are saved.
- [ ] Submit the same request key again with changed data. Verify it is rejected.
- [ ] Try another business/customer ID and a non-sales staff role; verify tenant isolation.
- [ ] Disable a VAT rule then submit. Verify no untaxed fallback order is created.
- [ ] Check mobile portrait and landscape, keyboard navigation, labels and payment previews.
- [ ] Open new order details and verify the status banner, completed-payment sum and balance.
- [ ] Record a later instalment from order details and verify total paid and balance update.
- [ ] Confirm original order invoicing, POS, ledger integrations and returns are unchanged.
- [ ] Run `npm run check:order-payment`, `npm run typecheck`, `npm run build`, the CI suite and Vercel Preview validation.

Do not promote to production until SQL 036, Next.js build, permissions, idempotency and payment reconciliations have been verified live in staging.
