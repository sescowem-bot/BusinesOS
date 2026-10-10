# Vercel build TypeScript fix — commit 4abad75

## Observed problem

Next.js 16.3.1 compiled successfully, but Vercel reported `TS2339: Property 'name' does not exist on type 'never'` at:

- `app/(dashboard)/invoices/page.tsx:16`
- `app/(dashboard)/orders/new/page.tsx:10`
- `app/(dashboard)/orders/page.tsx:14`

`Array.isArray(v.customers)` excludes the non-array branch from a relation that Supabase TypeScript inferred as an array, making `v.customers?.name` on that branch a `never` property read.

## Fix

The three pages now call the shared `lib/customer-relations.ts` `customerNameFromRelation()` function, which accepts `unknown`, safely normalizes Supabase relations returned as arrays or objects, validates the name, and uses the existing page-specific fallback.

No database schema, route, feature entitlement, customer permissions or email automation was changed. **No SQL or new environment variables required.**

## Deploy

1. On the GitHub repository `sescowem-bot/BusinesOS`, create a review branch from commit `4abad75` or the current `main` containing Phase 030D.
2. Copy the **four changed TypeScript files** in the patch ZIP to their exact paths; the optional Markdown note belongs in `MD/`.
3. Commit and trigger a Vercel Preview deployment. Check the full TypeScript validation and build.
4. Test `/invoices`, `/orders`, and `/orders/new` with a business user, both populated and empty customer lists. Confirm navigation, names and order creation still work.
5. Merge only after Vercel succeeds.

If your working branch is **older than Phase 030D**, review or use the full-source ZIP instead; do not blindly overwrite newer custom changes.

## Verification performed locally

- 58 application routes, no duplicates.
- 19 existing source/regression commands passed (phases 021–030D).
- Isolated strict TypeScript check of shared helper passed.
- Customer relation helper behavior validated for single object, array, empty and invalid values.
- ZIP entry/integrity checks passed.
- Full Next.js production build and live Supabase checks **not run** locally, because project dependencies were not installed.
