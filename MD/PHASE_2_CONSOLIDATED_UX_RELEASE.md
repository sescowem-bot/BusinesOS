# Phase 2 UX — one consolidated GitHub release

This release consolidates the Phase 2A–2E review work on top of GitHub main `7f1edae`. It retains the newer server-paginated customers, orders, payments, expenses and product registers.

## User-visible changes
- Simple / All tools sidebar navigation with searching and permission-filtered items.
- Mobile bottom navigation respects staff role; this is UI-only, not a permission grant.
- Next incomplete onboarding action for each user.
- Dashboard quick actions, reports and attention items follow plan features and role.
- Readable mobile order cards, table pagination and recovery states.
- Guided Free-plan-safe product catalogue and business onboarding forms.
- Clear error, missing-page and order-form loading states.

## Verification and production safety
- Existing server and Supabase database permissions remain authoritative.
- No SQL migrations, billing/Paystack changes, stock/RPC changes or data writes are part of this release.
- SQL 063 and 064 were manually executed in production before this release and are NOT included for replay.
- Previous isolated Phase 2 tests and installer tests passed; complete authenticated browser journeys remain unverified.
- GitHub CI was previously red because `verify-phase28b.cjs` expected legacy `BusinessRecordsTable` on newer server-paginated pages. The updated check now accepts either bounded server `ServerRecordRegister` with count or bounded legacy client table. Tenant scoping is still required.
- CI must run the existing `test:phase2` script over all `tests/phase2/*.test.mjs`.
- Permanent VAT accounting reconciliation, SQL 064 acceptance tests and full tenant isolation testing remain Phase 1/production acceptance blockers; do not claim them resolved by this UX-only release.

## Deployment caveat
Two Vercel projects appeared against the previous commit: `busines-oss` and `busines-os`. The team connection refused a project-configuration inspection, so duplicate build risk remains until the owner removes or disconnects the unintended project in Vercel.
