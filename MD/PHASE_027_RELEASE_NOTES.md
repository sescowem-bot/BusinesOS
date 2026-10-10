# BusinessOS Phase 027: Inventory, Finance, Tax and Permission Hardening

## Starting point

Built on the **Phase 026 email/branding full-source package**, preserving the professional System Owner dashboard, Resend testing components, logo/favicon admin uploads, plans, business workspace and accounting features.

## What changed

1. **New SQL migration 027** adds `inventory_stock_counts` (tenant scoped, RLS SELECT, no client direct writes) and a controlled physical-stock-count RPC. Counts lock the product row and reject stale expected quantities; actual differences create a movement entry in the same transaction. Unchanged counts are also logged.
2. The existing `inventory_adjust_stock` RPC now requires active `inventory` plan entitlement **and** Owner, Manager or Inventory role. Previous database code only accepted Owner. No inventory balance is reset by the migration.
3. The inventory page now shows stock on hand, physical stock counts, audit history and low-stock warnings, with mutation forms hidden for view-only roles. The page states its valuation/count limits.
4. New `/accounting/reconciliation` provides all-status counts for already-captured invoice, payment and expense events, plus a 100-event exception sample. It explicitly does **not** certify bank reconciliation, complete accounting or historical backfills. Access requires both the Accounting plan entitlement and a finance role.
5. Tax Discovery uses `getWorkspace()` so multiple-business users access their *selected* business, rather than always the oldest membership.
6. Tax Centre treats expired, future-dated, conflicting, unapproved or unsupported-rate VAT rules as requiring review. It remains a non-posting estimator and does not file returns or certify legal compliance.
7. Added `npm run check:phase27` and a CI step. Documentation remains under `MD/`; only `README.md` is at repository root.

## Installation order

- **Do not rerun SQL 001–026.** Confirm 025 and 026 were installed, that 023 exists, and the source version matches the Supabase project.
- Back up Supabase and first run `supabase/migrations/027_inventory_counts_security.sql` against **staging**. Then test the roles and stock count cases below.
- Merge the code into a preview branch and run `npm install`, `npm run typecheck`, `npm run check:phase27`, `npm run build`. Deploy Vercel Preview and exercise authenticated business flows.
- Run SQL 027 on production only after staging succeeds. A partially installed migration must be inspected, never blindly rerun.

## Staging acceptance tests

- Owner with active Inventory plan can count stock and adjust it. Manager/Inventory user can do so only when assigned the Inventory module in their plan role matrix. Sales or users without the plan cannot change stock, including through direct Supabase RPC calls.
- Enter physical count matching recorded stock: audit record is created, no inventory movement needed. Enter differing count: one stock movement and the exact variance. Submit an old expected balance after a second user changes stock: count is rejected; no mutation happens. Cross-business product ID is rejected.
- `/accounting/reconciliation` shows pending/error/posted source counts. Non-finance roles and business without Accounting access cannot reach the protected data. Comparing with ledger remains **human-reviewed**.
- Changing the selected business changes Tax Discovery and Inventory data context; tenant data must not leak across businesses.
- Tax Centre shows unapproved, expired/future/ambiguous rules as requiring review; no tax is posted to customer orders and no returns are submitted.
- Full TypeScript/production build, all routes on mobile, CMS/logo/favicon, Resend Admin test email, and Vercel Runtime Logs should be reviewed in Preview.

## Known remaining limitations

- Stock deductions are not automatically triggered from the current free-text sales-order workflow. Physical counts and adjustments are not automatically journalised. Valuation is *displayed products × cost* and is not a formal stock ledger reconciliation.
- The source-event report only checks the accounting queue. Bank feeds, manual journal duplicate matching, historical unimported transactions, credit notes and close-of-period certification are outstanding.
- The VAT preview currently assumes a fixed illustrative standard rate in `lib/tax/engine.ts`; rules inconsistent with that assumption are blocked from preview approval. It must not be used to invoice or file without professional review.
- Some legacy RPC roles and direct database policies outside the inventory and finance areas still need a comprehensive security audit.
- The full production build could not be verified in this offline environment, as installed npm dependencies are not present.
