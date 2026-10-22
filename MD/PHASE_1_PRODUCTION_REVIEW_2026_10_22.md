# Phase 1: production compatibility and regression checks

Release source is aligned to the owner's manually executed SQL 063 and SQL 064 on 2026-10-22. **Do not rerun or automatically migrate those SQL scripts.** Existing SQL migrations 001-056 are unchanged.

## Included in this commit

- A deterministic `package-lock.json` for CI, replacing the fallback to unlocked installs.
- `npm run test:phase1`: real Node.js tests of financial functions and VAT price guard.
- NGN kobo precision in the display formatter.
- POS frontend acknowledgement of the SQL 064 VAT-inclusive guard and safe customer explanation for that rejection.
- No changes to Postgres functions, stock, payments, tax reporting or historical records.

## Important production limitation

SQL 064 is already enabled and blocks any VAT-inclusive sale with a pre-tax discount and other inclusive sales that fail gross-price reconciliation. This patch adds a client-side warning; it **does not repair the root accounting problem**. It is never valid to bypass SQL 064 for a real sale. The authoritative SQL check must remain in place until an independently tested migration is approved.

The permanent VAT accounting correction needs exact line-level gross/net/tax evidence and coordinated order-item, payment, issued invoice and refund logic. This is still a Phase 1 release blocker.

## Verification

Locally, 11 new focused Node regression tests passed. The full repo typecheck, Next.js build and GitHub CI must still be verified after integration. Database transaction/tenant tests require a disposable PostgreSQL/Supabase project and actual fixtures; do not run them on production.

## Deferred review branches

The repository also contains unmerged proposals for access management and security foundations. Those have **not** been silently merged in this release. Keep the relevant refs until separately reviewed, and only delete branches once their unique commits are archived or merged. The desired eventual branch set is `main` plus at most two active review branches.

## Production safety

No automatic database migration should run. Never use service-role credentials in browser environment variables, and don't run fake POS sales against real customers.
