# BusinessOS — Public directory TS7006 Vercel build repair

## Vercel error

The Vercel Next.js build compiled but failed TypeScript checking at `app/directory/page.tsx`, complaining that the directory list callback parameter `b` implicitly had an `any` type.

## Repair

The directory component now declares an explicit `DirectoryBusiness` type matching the columns returned by `public.public_directory_list()` from migration 046, assigns `data` to a `DirectoryBusiness[]` for rendering, and handles null/error responses as an empty list. The business listing remains opt-in and verified; no contact/login email field was added to public results.

## Deployment

- For **the current GitHub main (78 routes)**, the minimal patch to repair this single TypeScript error is `app/directory/page.tsx`. Merge that file as a hotfix and rerun Vercel. This doesn't deploy unpublished features.
- For **latest unpublished Phase 030N-I source (80 routes)**, use the cumulative ZIP containing this repair, which preserves previous updates.
- The exact Vercel TypeScript error is repaired by declaring an explicit type. A full dependency-backed `npm run build` was NOT performed in the current environment, so other errors might appear later; keep the Vercel log if it fails again.

## SQL 048

SQL 048 is unrelated to the TypeScript error. Apply it only after verifying **046 and 047** succeeded, then run `MD/VERIFY_SQL_048_READ_ONLY.sql`. Migrations 044 and 045 should also be reconciled first. SQL 048 adds audited administrator plan assignments and private team updates, plus business-entitlement guards for advanced branches and approvals. Back up before modifying production.

## Tests executed

- `node scripts/check-routes.cjs` → 80 unique routes.
- `node scripts/verify-directory-types.cjs` → passed.
- 45 previously existing `scripts/verify-*.cjs` scripts → passed.
- TypeScript parser checked 250 app, components and lib `.ts`/`.tsx` files → syntax clean.
- Full TypeScript semantic typecheck / Next.js production build → not confirmed due to missing project dependencies in runtime.
