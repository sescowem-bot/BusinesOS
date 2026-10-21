# SQL 057–062: proposed staging migrations (NOT DEPLOYED)

**Status: SOURCE ARCHIVE / REVIEW ONLY — NO PRODUCTION APPROVAL.**

The currently deployed BusinessOS schema cannot be inferred from GitHub. Production-oriented migrations in `supabase/migrations/` currently end at SQL 056. The next six SQL drafts were developed separately and have **not** passed a complete staging migration, legacy authorization/RLS audit, or full checkout/Paystack integration test.

| Draft | Function | Status |
|---|---|---|
| 057 | Business-specific paid add-on offers | Staging review only |
| 058 | Privacy request fulfilment evidence | Staging review only |
| 059 | Operational events | Staging review only |
| 060 | Business and staff lifecycle / suspension | Staging review only |
| 061 | Membership write enforcement | Staging review only |
| 062 | Deletion/closure request governance | Staging review only |

## Safety and the SQL 062 error

If SQL 062 fails with `Stage 063 deletion requests already exist: inspect before retrying`, do **not** drop or truncate `platform_deletion_requests` and **do not** remove its protection. This is a deliberate duplicate-installation guard. Run `062_existing_install_diagnostic_READ_ONLY.sql` and examine both its object/RLS check and its column report. If objects are missing, prepare a database-specific additive repair rather than rerunning the original migration. The supplied 13-column listing matches the diagnostic's *selected* column set but does **not** establish that audit-event tables, guarded functions, or RLS are intact. No automatic account deletion occurs in this SQL.

## Before use

1. Take a verified database backup; do not apply these drafts to production.
2. Review schema drift and object availability on a separate staging Supabase project, including any partially installed stages.
3. Never rerun an already-installed `CREATE TABLE` migration to fix a single missing object.
4. Test account/business suspension against every privileged/read-only RPC, storage policy, and export route, and check that service role usage cannot bypass app-level permissions accidentally.
5. Verify signature checking, idempotency and actual test transactions with Paystack before enabling any payments.
6. Release any reviewed SQL through a distinct, tested migration and tracked PR; **copying these drafts into `supabase/migrations/` is not an approval to execute**.

No secrets, API keys or production customer data belong in Git history.
