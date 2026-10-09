# Phase 09 — Financial reports and tax compliance records

## Delivered
- Server-side, tenant-scoped trial balance, profit and loss, and simplified balance sheet from posted ledger records.
- Three CSV exports: trial balance, general ledger, and tax review history.
- CSV formula-injection hardening for spreadsheet viewers.
- Read-only Tax Compliance Centre with stored evidence and manually verified due-date records.
- SQL 010 for tax obligation reminders with RLS and restricted writes.
- Pure reporting test coverage.

## Important limits
- **Not a statutory tax filing system.** No VAT return generation, tax remittance, automatic tax deadline inference, or tax-law completeness claims.
- Operational orders, payments, inventory, expenses and journal postings are not yet automatically reconciled. Financial statements are based solely on manually posted ledger records and may be incomplete.
- No retained earnings closing, inventory valuation postings, year-end adjustments or cash-flow statement yet.
- General ledger export has a 10,000-line cap; large datasets require a paginated server-side export worker before commercial deployment.
- CSV exports work in Excel. Native XLSX and formal PDF reports are future work.
- Date-range filtering and complete VAT transaction schedules remain future work. `tax-review` currently exports snapshot metadata only.
- The source uses finance roles and business RLS. SQL migrations 001–010 must be tested in a staging Supabase project.
- The full Next.js build and live DB integration have not been verified here.

## Deployment sequence
1. Validate all preceding migrations in staging; apply `010_tax_reporting_reminders.sql` last.
2. Configure server-side Supabase environment variables; test access as different businesses and a non-finance member.
3. Exercise `/reports`, `/tax-compliance`, and all three `/api/reports/export` variants.
4. Reconcile reports against source journal entries and accountant-reviewed expected values.
5. Validate statutory deadline sources and approval procedure before inserting or verifying reminder records.
