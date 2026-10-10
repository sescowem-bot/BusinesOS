# Phase 027 deployment summary

**Archive baseline:** `BUSINESSOS_PHASE_026_EMAIL_BRANDING_FULL_SOURCE.zip`.

- This release is additive to Phase 026 and contains migration **027**.
- The **full-source ZIP** holds the entire project. The **changed-files ZIP** contains 16 updated/new files only, retaining their exact repository paths.
- Root Markdown policy: README.md at repository root, all other `.md` files under `MD/`.
- No GitHub push, Vercel deployment, SQL execution, or external email dispatch has been performed here.
- Local source checks pass: 55 unique routes; all available earlier structural/regression suites pass.
- npm dependency installation timed out. This environment could not run `npm run typecheck` or `npm run build` as a real Next.js production build. Must confirm in Vercel Preview.

## Rollout order

1. Check that migration 026 completed. Back up database. Run migration 027 in staging **once**.
2. Apply source to a GitHub preview branch and let CI run `npm run typecheck` and `npm run build`. Repair any failures before production.
3. Test stock count with owner and staff, concurrent changes, cross-business product IDs, and read-only role. Test tax-discovery business switching.
4. Use `/accounting/reconciliation` to review posting exceptions; **do not** assume bank accounts are reconciled.
5. Roll out to production after passing staging and obtaining approval. Do not rerun migrations 001–026.

See `PHASE_027_RELEASE_NOTES.md` for details and `PHASE_027_READ_ONLY_SQL_CHECK.sql` for harmless database diagnostics.
