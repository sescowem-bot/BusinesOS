# Phase 14 — Team, Branches and Approvals

## Implemented
- Business-scoped team directory and owner-only email invitation creation.
- Verification-based invitation acceptance RPC (requires confirmed Supabase Auth email).
- Owner-only branch creation; branch membership schema and tenant isolation.
- Owner-reviewed approval requests, with no self-approval.
- Explicit separation of tenant membership and platform Super Admin roles.

## Limitations
- Invitation email delivery and user-friendly accepting invitation route are not implemented; acceptance RPC is provided for integration.
- Branch inventory and financial consolidation require later integration.
- Existing business module permission checks require systematic RBAC integration, beyond the owner gates in this phase.
- Approvals do not authorise automatic financial transactions.
- Migration 014 not applied on production; validate dependencies and RLS in Supabase staging.

## Deployment
Apply previous migrations in order before 014. Run npm install, npm run typecheck, npm run build, then RLS, role isolation, invitation expiry/email verification and approvals tests on staging.
