# BusinessOS dashboard unavailable — targeted repair and diagnosis

## What was discovered in source

`app/(dashboard)/dashboard/page.tsx` previously displayed “Apply SQL migration 042” whenever the `business_dashboard_command` RPC failed. It did not distinguish an uninstalled function, an access error, a query failure, or a timeout.

There is also a concrete SQL date-window mismatch:

- SQL 042: `business_dashboard_command` asks `business_pos_management_report` for the entire present month, ending on the last calendar day.
- SQL 041: `business_pos_management_report` rejects reporting periods ending after `current_date + 1`.
- Therefore, on most days of a month, businesses with Financial Reporting enabled can get a report error and lose their dashboard summary, **even if SQL 042 is fully installed**.

SQL 045 corrects the current-month POS reporting period by passing the lesser of the month-end date and today's Lagos-local date. It **does not** alter the financial amounts, item cost evidence, existing invoices, orders, or customer payments.

The source error-state patch changes the misleading unconditional SQL 042 instruction into distinct messaging for missing RPC, lack of permission, server timeout, and other reporting errors. It shows a retry link and paths to the order register and support.

## Safest installation order

1. Back up the Supabase database and the repository.
2. Run `BUSINESSOS_DASHBOARD_042_READ_ONLY_DIAGNOSTIC.sql` from the top-level download first. It inspects objects 040–044 and returns migration evidence, RPC grants, and key schema columns. **All object checks present still do not guarantee that an RPC will execute correctly.**
3. If SQL 041 or 042 is missing, first install the correct **original migration** in sequence in a staging database (do not run 045 prematurely). If objects are **partial**, STOP and reconcile; do not simply rerun the earlier migration.
4. When SQL 041–044 are installed, apply `supabase/migrations/045_dashboard_current_month_reporting_window.sql` in staging. This file is a guarded transaction and will stop if its prerequisite RPCs/role tables are absent.
5. Run `MD/VERIFY_SQL_045_READ_ONLY.sql`. Expected: all five booleans `true`.
6. Merge the single-page dashboard UI change into a review branch, verify `npm run check:dashboard-runtime-date`, then deploy to Vercel Preview.
7. Log in as both (a) business owner with Financial Reporting enabled and (b) a business user without that entitlement. Check the dashboard totals and role/privacy restrictions. Test both the first and last dates of the month if possible.
8. If the dashboard still fails, check Vercel server logs for `[businessos-dashboard] financial summary unavailable` and share the sanitized PostgREST **error code** (not database secrets). The checker cannot simulate a user JWT inside the Supabase SQL Editor.

## No guesswork about deployment status

These changes have only been prepared locally. The SQL checker does not access your Supabase database, and no live migrations have been applied. The source build must still pass complete Next.js typechecking and a production build with project dependencies before promotion.

## Financial safeguards

- All dashboard financial metrics continue coming from the authenticated Postgres business-scoped summary function.
- No fallback with made-up zero balances is added.
- The dashboard summary remains blocked on unverified data; orders and payments can still be accessed separately.
- This is a runtime/date-window correction, **not** a change in how profit, VAT, receipts, or expenses are calculated.
