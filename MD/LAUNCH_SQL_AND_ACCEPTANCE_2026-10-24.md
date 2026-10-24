# BusinessOS 24 October 2026 — Configuration & launch status

## Applied SQL (do NOT run again)
Installed in connected Supabase project through migration:
`20261024193749_businessos_plan_action_quota_trial_configuration`
A copy of the exact **already-applied** SQL is in `review/sql/20261024193749_businessos_plan_action_quota_trial_configuration_APPLIED.sql`.

Confirmed live:
- `platform_plan_action_overrides`, `platform_plan_action_audit`, `platform_plan_action_enforcement`
- `platform_plan_usage_limits`, `platform_usage_enforcement`, `platform_usage_limit_audit`
- `platform_plan_trial_settings` and System Owner RPC `admin_set_plan_trial`
- 54 dormant Free role preferences disabled, with evidence in `platform_free_role_cleanup_evidence`
- New settings may be saved, but **action and quota enforcement remain disabled until all write functions have been tested**.
- Trials are configuration preferences only. The system DOES NOT automatically grant or expire paid access on trial settings yet.

## Before a paid launch (still NOT certified)
1. Authoritative POS VAT, invoices, refunds and accounting must use reconciled exact evidence. The existing SQL 064 guard is not the fix.
2. Enforce configurable action permissions in each server writer RPC and RLS; tests must cover tenant isolation.
3. Enable numerical limits only after transaction writer and two-session concurrency acceptance; tables/triggers exist but the switch is disabled.
4. Run a real Paystack test-mode payment, webhook and idempotency acceptance. No customer should activate paid access without provider verification.
5. Complete active, lawyer-approved published Terms of Service/Privacy versions; approval/reference must be authentic.
6. Trial preference must be tied to verified subscription expiry before describing trials as available.
7. Measure slow routes and verify the updated mobile, auth and cookie experience.

## Website behavior
- Signup and reset UI/validation minimum password length: eight characters. Supabase Auth strength settings must permit eight; verify in Supabase Dashboard > Authentication > Settings.
- Public cookie notice refreshed and can be reopened from the public footer. Only necessary cookies are currently active; no fake optional consent toggles.
- One simple Terms acceptance checkbox with Terms and Privacy links; no false legal approval.
- Sign-in remains generic on invalid credentials to prevent account enumeration.
