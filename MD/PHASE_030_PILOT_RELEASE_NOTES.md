# Phase 030 — Controlled Pilot and Release Readiness

## Scope

This release adds **Pilot Readiness** at `/admin/pilot` to the existing redesigned System Owner console. It does not open public registration, deploy a new platform, trigger email delivery, change a subscription plan or claim production certification. The business and CMS features are carried forward from Phase 029.

### Included

- Administrator-only pilot acceptance register with **23 tests** covering authentication, tenant isolation, business transactions, finance, inventory, approvals, branding, email delivery, mobile experience and builds.
- Separate **Vercel Preview** and **Production** review registers. Each pass/fail/blocked result requires human-written, redacted evidence.
- SQL 028 adds `platform_pilot_results`, `platform_pilot_audit` and `platform_record_pilot_check`; only an active System Owner can read review records or call the write RPC. Direct client writes are revoked. Recorded updates have an audit history.
- Read-only system indicators for config presence, published pricing, publication of Terms, Privacy and Cookies, logo/favicon URL configuration, and Resend sender setup. Config presence is never represented as provider reachability or approved legal content.
- A **read-only** command-line smoke script for public pages and anonymous access denial. Does not authenticate, insert test data or send email.
- New GitHub Actions check, testable invariants, and documentation in `MD/`. Only `README.md` remains at project root.

### New URLs / scripts

- `/admin/pilot` — review Vercel Preview evidence
- `/admin/pilot?environment=production` — review production results separately
- `npm run check:phase30` — local source/security invariants
- `npm run smoke:pilot -- https://YOUR-VERCEL-PREVIEW-URL` — read-only public/protected route checks
- `supabase/migrations/028_pilot_acceptance_register.sql` — additive Supabase migration **after 027**

### Safe deployment sequence

1. Confirm SQL migrations 001–027 in **staging**; do not rerun previously installed SQL. Back up production.
2. Apply migration 028 **to staging first**. Verify that non-admin users cannot read `platform_pilot_results` or audit rows or call `platform_record_pilot_check` successfully. Then apply to production only after review and approval.
3. Merge this project to a separate Git branch. Review changes to avoid overwriting newer work. Run `npm run check:phase30`, full CI, `npm run typecheck`, `npm run build`, and Deno check.
4. Deploy to **Vercel Preview**. Visit `/admin/pilot` while signed in as an active System Owner. Anonymous users and business staff must be denied access.
5. Run `npm run smoke:pilot -- https://YOUR-PREVIEW-DOMAIN` from a machine with internet access. Note that `/terms`, `/privacy`, and `/cookies` can show review notices while documents remain unpublished; these must be reviewed before launch.
6. Execute the complete test matrix in `MD/PHASE_029_PRODUCTION_ACCEPTANCE.md` with **real staging users and tenant-separated data**. Record evidence using the Pilot Readiness page. Never paste passwords, tokens, customer details or API keys.
7. Have a separate reviewer inspect critical test evidence and release configuration. Resolve failed/blocked items before considering a controlled pilot.
8. Explicitly confirm the fallback for Supabase Auth emails and that financial auto-posting is either verified or disabled.

### Release blockers

The project remains **NOT CERTIFIED FOR COMMERCIAL LAUNCH** until the following have been verified against the exact candidate commit: full TypeScript and Next.js builds; GitHub CI including Deno; no cross-business access; plan/role enforcement; transactional invoice and payment tests; reconciliation and stock count concurrency; email provider delivery/webhook protection; and mobile/keyboard review.

### Limitations

- A stored `pass` is a reviewer assertion, not independently proven by the application; admins must review evidence and never treat all-green counters alone as launch approval.
- SQL migration 028 adds a register, not a global feature flag or signup gate. Actual pilot invitations/access require separate product and operational decisions.
- Presence of Supabase/Resend environment variables does not prove connectivity or provider identity verification.
- Full production build and live Supabase/Resend checks require connected infrastructure and deployment. The included smoke script only verifies public routing and rejection of anonymous access.
