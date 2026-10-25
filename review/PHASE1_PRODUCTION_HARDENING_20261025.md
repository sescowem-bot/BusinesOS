> **Superseded audit snapshot.** See [Phase 1 release ledger](PHASE1_RELEASE_LEDGER_20261025.md) for all 10 migrations applied on 25 October 2026. The earlier three-migration snapshot below is historical, not the current deployment state.

# Phase 1 — Production database hardening, 25 October 2026

## Verified production work (applied)
Connected Supabase project: `vvhifvbsczgboeabmdan`.

Three successful, individually applied migrations:
1. `businessos_phase1_payment_action_guard`: replaced `public.crm_record_payment` while retaining its payment amount, order-row locking and overpayment checks. Added active tenant membership, legacy role, core Payments entitlement and Payments:Create action check.
2. `businessos_phase1_customer_expense_rls_controls`: installed **six** restrictive RLS policies on `business_customers` and `expenses` (INSERT, UPDATE, DELETE for each). Policies enforce role, core entitlement and matching action decision. Revoked general authenticated/anon TRUNCATE, REFERENCES and TRIGGER privileges on these two tables.
3. `businessos_phase1_customer_and_expense_rpc_permissions`: replaced `crm_create_customer` and `gl_record_paid_expense` without changing their signatures or customer/expense validation. Added module and action checks inside each privileged writer. Business creation requires owner, manager, finance or sales. Expense creation retains its finance eligibility requirements.

**All operations above were reported successful by Supabase and later read-only queries confirmed three guarded procedures and six restrictive policies.** Do not execute the earlier `review/sql/20261025_phase1b_core_rpc_rls_REVIEW_ONLY.sql` on this database: its proposed procedures and policy names are superseded by the successful migrations above.

## Still not complete
Global `platform_plan_action_enforcement.enabled` remains `false`. It must NOT be enabled yet. `platform_plan_action_overrides` has no rows and no end-to-end role-/plan-matrix tests have been performed.

A live read-only audit showed the following exposed SECURITY DEFINER procedures still lack direct references to the new action/core authorization functions:
`crm_create_order`, `crm_create_order_with_initial_payment`, `crm_create_order_with_cost`, `business_pos_checkout`, `business_pos_checkout_at_location`, `business_pos_checkout_split`, `business_complete_pos_return`, `business_request_pos_return`, `issue_business_invoice`, `catalog_create_item`, `inventory_adjust_stock`, `business_transfer_location_stock`, `business_create_purchase`, `business_record_supplier_payment`, and `gl_post_journal`. The full exposed RPC inventory is even larger.

A safe future rollout must trace every RPC, wrapper and trigger, not simply introduce a blind global trigger: POS, inventory, refunds and posting fan out into other tables, and a universal table-level role check can reject valid nested writes.

## Controls and acceptance
- Preserve current customer records, plan assignments and approved payments.
- Review exact routine definitions and grants before each targeted replacement. Keep signatures, transactional idempotency and RLS protections unchanged or stronger.
- Build disposable authenticated tenants with every staff role; verify allowed operations as well as denied direct RPC and REST calls. Check cross-business, inactive/suspended memberships, VAT refund, POS split tender, stock movements and accounting queue.
- Configure and test audited matrix allows/denies on Free/Starter/Growth/Professional, including disabled modules and expired entitlements; 'allow' must never broaden subscription entitlements.
- Verify rollback and restore, record a signed-off acceptance matrix, then enable global action enforcement. Until then only previously existing role guards and the newly installed targeted checks are active.

## Live read-only verification
See `review/sql/20261025_phase1_live_READ_ONLY.sql`. Expected now: 6 installed restrictive Phase 1 policies, 3 guarded core procedures, global action flag disabled.
