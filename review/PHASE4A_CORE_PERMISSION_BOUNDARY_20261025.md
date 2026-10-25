# BusinessOS Phase 4A — Core action server boundary
Date: 2026-10-25

## Database baseline (read-only verification)
- Business Platform production has all 32 core module rows enabled across Free, Starter, Growth and Professional.
- Both `business_plan_core_feature_allowed(uuid,text)` and `business_can_perform_action(uuid,text,text)` are executable by authenticated members.
- The global action enforcement switch is OFF; numerical enforcement is OFF.
- Action override rows: 0; numerical quota rows: 0; Free role cleanup evidence rows: 54.
- This release performs NO production SQL and changes NO subscription prices, Paystack, VAT or customer records.

## Phase 4A implementation
- Shared, server-only, fail-closed `coreActionAllowed` calls both database authorization functions.
- Checks are added before the primary write RPCs for customers, manual orders, partial first-order payments, subsequent payments, paid expenses, commercial invoices and missing order-cost evidence.
- The older staff roles remain required independently. In particular, customer and payment writers now reject unauthorised staff roles at the server-action entrypoint.
- New-customer/new-order forms reject direct navigation for a plan/role that cannot create.
- Customer/order list CTAs and order detail actions are hidden when corresponding plan/action checks deny.
- The checks do not enable dormant action overrides and do not modify PostgreSQL access policies.

## Critical security limitations
This is NOT complete transaction-level enforcement. Some existing `SECURITY DEFINER` procedures still check business membership only. Authenticated users invoking RPC endpoints directly can bypass the new Next.js server-action checks, so the database layer remains a go-live blocker.
- Before enabling the platform action switch, every writer RPC must call an equivalent authorization check inside its own transaction, including POS, invoices, payments, expenses, inventory, refunds, returns, role management and exports.
- RLS and direct REST write permissions must be audited, including across tenants.
- Preserve owner account recovery and avoid downgrading existing customers.
- Database review and an appropriate staging/isolated multi-user acceptance test are required before any enforcement flag is changed.

## Follow-up phase
4B — DB transaction boundary and negative tests (Free staff vs paid modules, cross-tenant RPC, direct-table writes, denied role actions, active/expired subscriptions). Then 4C — administrator review and deliberate production activation only after all writers and rollback paths pass.

## Evidence
Read-only SQL verified both authorization RPCs and the disabled enforcement flag. Full browser role journeys and adversarial RPC tests are NOT yet verified.
