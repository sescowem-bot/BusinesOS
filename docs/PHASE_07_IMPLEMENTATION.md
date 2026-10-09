# Phase 07: Accounting foundation

Added migration 008, an accounting page, controlled account and period setup, atomic manual journal posting and RLS-protected trial balance.

## Run order
Apply migrations 001 through 008 in sequence on a test environment. Do not reset production. Configure Supabase and verify memberships.

## Important limitations
- Sales, payments, inventory and expenses **do not yet post automatically** to GL. Do not post duplicate manual entries and future automated entries.
- The trial balance reflects manual GL entries only, not all operational transactions.
- This is not yet a balance sheet, profit and loss, receivables ledger or tax engine.
- Current post form creates one debit and one credit. API function accepts multiple lines.
- Automatic reversals, period close workflow, source-event integrations, opening balances and reconciliation remain pending.
- On production, validate PostgreSQL version supports security_invoker views.

## Test plan
1. Owner can create a ledger account and period.
2. Staff without finance role is denied.
3. Two businesses cannot see each other's ledger.
4. Unbalanced multi-line RPC must rollback with no journal.
5. Posting outside open period fails.
6. Direct table writes by authenticated clients fail.
7. Trial balance debit equals credit after posting.
8. Check production build, RLS, journals, and SQL migration on a staging database before deploy.
