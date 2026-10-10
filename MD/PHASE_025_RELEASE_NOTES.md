# BusinessOS Phase 025 — Controlled Accounting Integration

## Summary

Phase 025 implements the first practical integration between commercial invoices, customer receipts, paid expenses and the general ledger. It adds tenant-scoped event capture, an opt-in accounting mapping form, posting retry status, explicit historical transaction discovery and a functional paid-expense form. It also reorganises the repository documentation: the root contains `README.md` only; other Markdown files are stored in `MD/`. A cleanup command is available for existing GitHub checkouts.

## Files

- `supabase/migrations/024_accounting_source_integration.sql`: additive database migration (after 023).
- `app/(dashboard)/accounting/page.tsx`: integration dashboard, source status, trial balance and journals.
- `app/(dashboard)/accounting/integration-forms.tsx`: mapping editor and queue controls.
- `app/(dashboard)/accounting/integration-actions.ts`: checked finance server actions.
- `app/(dashboard)/expenses/page.tsx`, `actions.ts`, `expense-form.tsx`: live paid-expense recording and register.
- `app/(dashboard)/reports/page.tsx`: accurate journal-based reporting disclaimer.
- `scripts/verify-phase25.cjs`: static source and safety checks.
- `scripts/organize-docs.cjs`: idempotent docs cleanup; `npm run organize:docs`.
- `MD/PHASE_025_ACCOUNTING_INTEGRATION.md`: complete accounting usage and limitations.
- `MD/PHASE_025_READ_ONLY_CHECK.sql`: post-migration schema inspection.

## Tested in this environment

- Route audit: **54 routes, no duplicates**.
- Phase 021 source parser / calculation / tax tests / financial reporting tests: **passed**.
- Existing Phase 022, 023, 024, website and plan checks: **passed**.
- Phase 025 static source and structure checks: **passed**.
- Documentation cleanup: **35 Markdown documents moved into `MD/`**, `README.md` remains at project root.
- ZIP integrity: to be validated on packaging.

## Not verified

- `npm install` failed with `EAI_AGAIN` resolving `registry.npmjs.org`; therefore **no full dependency-backed TypeScript typecheck or production Next.js build** was possible here.
- No live Supabase database connection or integration tests occurred. Financial posting, PostgreSQL migration syntax and tenant RLS **must be validated on a staging Supabase project** before production.
- No GitHub push or Vercel deployment has occurred.

## Critical rollout sequence

1. Back up GitHub and database. Ensure migrations 001–023 have been installed. Do not rerun installed migrations.
2. Apply `024_accounting_source_integration.sql` to an isolated staging database; then execute `MD/PHASE_025_READ_ONLY_CHECK.sql`.
3. Deploy the source code to Vercel Preview and run `npm ci` (after generating and committing a valid lockfile), `npm run typecheck`, `npm run build`, and `npm run test:accounting`.
4. Open `/accounting`, create mappings and an open period. Do not enable posting without an accountant validating the accrual policy and opening balances.
5. Test an issued invoice, payment before and after an invoice, paid expense, partial payment, retry, and repeat request. Compare journal lines and trial balance.
6. Review existing manual journals **before** discovering historical transactions; existing manually recorded entries could be double counted if the same source is imported.
7. Promote only after successful regression, security and accountant sign-off.

### GitHub documentation cleanup

For an existing local Git checkout, after applying new files run `npm run organize:docs`, then commit tracked moves/deletions with `git add -A`. Simply uploading files without removing old root Markdown files leaves duplicates in GitHub. Do not delete `README.md`.

## Out of scope

Refunds and credit notes, inventory COGS, tax-law verification, full bank reconciliation, period close approval, payroll, and automated historic migration of existing manual GL balances are not solved in this phase. This is not a certified accounting or tax engine.
