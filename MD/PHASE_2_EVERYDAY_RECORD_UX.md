# BusinessOS Phase 2: everyday record discovery and simpler registers

Implementation baseline: main at `b511ea7582c2d7a99c88f7b164ff8d4a4b3bc8a1`.

## Improvements

- Customer directory: business-scoped server search across customer name, phone and email, exact matching counts and stable 25-row pagination. No fabricated balances from the newest 1,000 transactions.
- Orders: server search by order number, customer-specific deep links, exact order-related payment totals for the displayed rows, clear payment-status explanations and page-scoped summaries.
- Payments: reference search, recorded-status filter and stable history navigation. Only completed entries contribute to received-page totals. Order numbers are resolved only for displayed rows.
- Products and services: business-scoped name/SKU search, active/inactive filter, pagination, page-scoped low-stock warnings.
- Expenses: search descriptions from the database and preserve search terms when moving between pages. Paid amounts remain formatted with two decimal places.
- New orders: when starting an order for a customer older than the 500 visible dropdown choices, the specified customer is verified through `business_customers` for the current workspace and inserted into the selector.
- One responsive, keyboard-accessible, reusable record register. Inputs are bounded to 80 characters; untrusted filters and customer IDs are validated before composing queries.

## Security and financial protections

Every main list uses an authenticated `getWorkspace()` call and restricts queries by `business_id`; customer/order deep links also verify membership. No SQL, RLS policy, tax calculation, payment mutation, subscription, pricing plan, billing gateway, refund or inventory write is changed. Existing SQL 063/064 remain production-installed and are not replayed.

Page totals are labeled page-only. Never infer full-period balances from a limited row sample. Counts are scoped to the requested directory filters; they do not represent all-time monetary totals.

## Verification gates

Run `npm ci`, `npm run check:phase2-registers`, `npm run test:phase2`, `npm run check:phase30n-ux`, `npm run check:expenses-speed`, `npm run typecheck`, and `npm run build`. GitHub Actions runs full verification after the one approved push.

Before declaring production acceptance, run browser tests on at least 1,001 customers and 10,001 transactions, verify the actual Supabase/PostgREST foreign-table search `customers!inner`, review query plans/indexes and user-permission behavior with two real tenant test accounts. This work requires isolated fixtures and is **not** proven by source tests.

No extra GitHub branches. No production SQL migration. If GitHub CI or Vercel fails, stop rather than create repeated speculative pushes.

## Phase 1 boundary

The permanent VAT-inclusive accounting correction, complete real-database transaction tests and refund/credit-note reconciliation are separate unresolved Phase 1 release gates. These Phase 2 UX changes do **not** claim those fixes.
