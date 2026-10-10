# BusinessOS — Phase 029: Release Verification and Security Controls

## Scope

This phase focuses on a repeatable production-quality gate. It adds no new database tables and does not enable new paid integrations. It preserves Phase 028B routes, Super Admin CMS, branding, subscription permissions, accounting and notifications.

### Verified source changes

1. **Financial CSV completeness guard**: Previously, `/api/reports/export` could return a partial list if PostgREST capped results. Every exported database query now asks for an exact count, and the server refuses to produce the CSV if the returned row count does not match. Incomplete exports return HTTP 409 instead of a misleading downloadable file. The exporter currently has a 10,000-row query limit per dataset. Data above that size needs a future streaming/paginated exporter. The ledger export also rejects source lines without matching journals. These are protective controls, not a guarantee of a transactionally consistent snapshot if data is being changed concurrently.
2. **Diagnostic endpoint access**: `/api/setup-status` now requires an active Platform Super Admin; unauthorised visitors receive 403. The endpoint does not disclose keys or values.
3. **Release CI**: GitHub Actions now runs all existing Phase 021–028B checks, Phase 029 invariants, TypeScript, Next.js production build, and a separate Deno check for the Supabase Send Email Auth Hook. The Next.js typecheck still excludes `supabase/functions/**` because those files run under Deno.
4. **Documentation**: Every non-README Markdown file remains in `MD/`; the root README links to this release.

### Not yet verified in this environment

- Running a full `npm install`, `npm run typecheck` and `npm run build` with the project's actual dependencies.
- Whether SQL migrations 021–027 were installed and fully validated in production.
- Live Supabase Row Level Security and tenant isolation under owner, staff, outsider and System Owner sessions.
- Supabase Auth Hook, branded email, Resend delivery, verified callback signatures and provider event reconciliation in live operation.
- Concurrent stock counts, invoice issuance, partial payments, expense posting, general-ledger balancing and reconciliation on a staging database.
- Mobile browser screenshots, visual regression, keyboard navigation, security testing and performance profiling.

### Safe deployment

1. Use an isolated Git branch and Vercel **Preview**, not immediate production overwrite.
2. Run `npm install`, `npm run check:phase29`, `npm run typecheck`, and `npm run build`. Check GitHub Actions including the independent Deno job.
3. In Preview, test the owner dashboard, business workspace switching, active/inactive Super Admin rights, CMS, upgrade approvals, invoices, expenses and stock counts.
4. Export reports with **0 records**, a small valid dataset, and data exceeding the configured Supabase maximum rows. Verify incomplete responses return `409` JSON and **no CSV**.
5. Run the acceptance matrix in `MD/PHASE_029_PRODUCTION_ACCEPTANCE.md`. Record failures with URL, account role, timestamp, steps, and Vercel runtime log entry. Do not post API keys in issue reports.
6. Keep automated accounting and replacement Supabase Auth emails disabled until tests pass in staging.

**SQL:** No new SQL migration in Phase 029. Do not rerun migrations 001–027.

**Release verdict:** Source hardening ready for independent CI and integration verification; **not certified production-ready**.
