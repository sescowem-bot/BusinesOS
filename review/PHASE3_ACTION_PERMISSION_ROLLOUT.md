# Action-level permission matrix — staging release
## User goal
Each subscription plan (including Free) has core and optional premium modules.
The System Owner can review permissions for Owner, Manager, Finance, Sales, Inventory, and Staff.
Every module has View, Create, Edit, Delete, Approve and Export preferences.

## Current deployment policy
- This branch contains a safe UI route and a **review-only** additive SQL draft.
- The SQL must be audited and executed on disposable staging with matching versions of migrations 001–064.
- No production SQL is applied by a GitHub push.
- The UI reports "pending database setup" until the SQL exists.
- Storing preferences is not the same as enforcing them. Current legacy RLS and per-RPC checks remain authoritative.
- "Allow" cannot bypass subscription entitlements, the original role, business membership, or accounting approvals.
- "Deny" is only enforceable after atomic guards have been installed on all sensitive RPCs and direct table writes.
- No new or existing permission is turned on by default; unconfigured actions inherit the old access model.
- The System Owner action save RPC verifies auth.uid(), validates complete matrices, and audits effective changes.
- A special invariant prevents removing an owner's ability to view essential business settings.
- Legacy Free plan has enabled dormant premium-role preference records but no premium module grants; do not treat those preferences as active access.

## Database acceptance before enabling
1. Confirm migration records and SQL 063/064 trigger state in connected Supabase.
2. Apply the review SQL to disposable staging, run direct signed-in non-admin RPC rejection.
3. Verify admin save, authorization, audit immutability, tenant isolation, duplicate/invalid input rejection.
4. Integrate deny checks into customer, order, payment, product, expense, inventory, finance and export RPCs. Ensure direct REST writes and privileged functions cannot bypass them.
5. Explicitly define legacy behaviours for owner, paid-tenant expiry and company custom roles.
6. Test every role/plan/action including a Free user trying to access Professional tools.
7. Roll out with feature flags, logs, backups, rollback runbook; only then consider production enablement.

## Other remaining blockers
Permanent inclusive-VAT accounting correction, payment checkout E2E and idempotent webhook acceptance, database-enforced usage limits, privacy retention and full route-latency profiling.
