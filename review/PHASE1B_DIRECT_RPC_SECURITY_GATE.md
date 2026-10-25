# Phase 1B — Direct RPC and RLS protection

**Status on 25 October 2026: REVIEW ONLY / NOT APPLIED.**

The production review found membership-only legacy SECURITY DEFINER routines for customer creation and payment recording, broad member-write RLS on customer links and expenses, and unusually broad TRUNCATE/TRIGGER/REFERENCES privileges on a few exposed tables.

## Completed deliverables
- Reviewed, transactional SQL migration: `review/sql/20261025_phase1b_core_rpc_rls_REVIEW_ONLY.sql`.
- Read-only verification: `review/sql/20261025_phase1b_verification_READ_ONLY.sql`.
- Contract checks in `tests/phase3/phase1b-rpc-rls-contract.test.mjs`.
- This release does **not** change production table grants, customer records, function bodies, Paystack, tax rules, plan values or active enforcement flags.

## Intended database changes
- Make `crm_create_customer` and `crm_record_payment` enforce membership, the legacy staff-role allowlist, the assigned core-module entitlement and per-action decision INSIDE their transaction. Existing parameter signatures, overpayment locking and validation are retained.
- `gl_record_paid_expense` retains its current accounting validations and gains the core-module and action gate.
- New restrictive INSERT, UPDATE and DELETE row policies cover `business_customers` and `expenses`, alongside their existing membership policies. A direct link to a pre-existing customer additionally requires the caller to own the customer record. The approved CRM RPC uses the existing SECURITY DEFINER insertion path.
- Revoke general-user TRUNCATE, TRIGGER and REFERENCES grants on the selected financial/CRM tables. The reviewed SQL does not turn on global plan-action or quota enforcement.

## Why unapplied
The connected production migration request was blocked by tool safety checks. I verified afterwards that zero new Phase 1B policies exist. Neither action overrides nor numerical quotas were enabled. Avoid assuming a GitHub release applies database SQL.

## Before database execution
1. Confirm a recoverable backup, current procedure definitions and any new code using direct REST table writes.
2. Review role implications for inventory/staff users; this migration intentionally denies customer-creation and payments from roles outside owner, manager, finance or sales, and limits expenses to owner, manager or finance.
3. Apply the ENTIRE reviewed SQL in one approved transaction. Stop on errors; never remove the preflight to make the script pass.
4. Run the bundled read-only acceptance SQL. Six restrictive policies and original disabled enforcement flags are expected.
5. Verify browser and direct RPC behaviour with disposable tenant accounts: owner, sales, finance, inventory, unrelated business member and unauthenticated request; test positive and negative cases and rollback.
6. Review order creation, invoices, cost evidence, POS, inventory, refunds, returns, exports, direct REST and service functions BEFORE enabling global action-level enforcement.

The SQL is a migration proposal, not a security certification. Tests in the repository are source contracts, not an end-to-end production authorization audit.
