# Phase 13 — Business Intelligence implementation

## Delivered
- Replaced demo-based Insights page with authenticated, business-scoped queries.
- Added server-side current and previous calendar-month metrics and insight triggers.
- Added overdue order, outstanding payment, low-stock, sales trend and month comparison views.
- No paid AI API. No SQL changes required.

## Boundaries
- Operational sales reflect orders created during each calendar month, excluding cancelled orders.
- Receipts reflect completed payments dated during each month.
- Outstanding balances include all historical non-cancelled orders and completed payments.
- The report refuses to display potentially truncated data. For large workspaces, add database-backed aggregate RPCs or paginated reads.
- Does not claim true cash flow, GAAP profit, or tax liability. Ledger reconciliations and operational posting integration are still pending.
- Not tested against live Supabase.

## Deployment
Apply migrations 001–013 as required; no Phase 13 migration. Install dependencies and run `npm run typecheck`, `npm run build`, and integration tests.
