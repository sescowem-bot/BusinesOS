# BusinessOS — Vercel build errors TS7006 / TS2352

## Based on Vercel build of `sescowem-bot/BusinesOS`, `main`, commit `46623d7`

Vercel successfully compiled Next.js 16.3.1 but failed in TypeScript checking:
- `app/directory/page.tsx(10,426)`: TS7006, callback parameter `b` implicitly has type `any`.
- `app/api/business/export/route.ts(44,20)`: TS2352, dynamic Supabase `select` inferred a parser error type; asserting it directly to `Record<string,unknown>[]` is not supported.

## Targeted changes

1. **Public directory**: supply a `DirectoryBusiness` type and a small runtime guard for RPC result rows. The listing still renders only returned verified and opted-in public business profiles; no private client fields are introduced.
2. **Business export endpoint**: treat the query output as `unknown`, validate that it is an array of record objects, then append the rows. This fixes the type mismatch without a blind cast or using `any`. The authenticated owner-only check, 10,000-row cap, CSV column set and no-store headers remain unchanged.
3. **Regression checks**: strengthen the existing directory typing check and add `scripts/verify-vercel-type-hotfix.cjs` to catch these specific mistakes.

## Deploy

To repair GitHub `main` (commit `46623d7`), copy the two application files from the **changed files** ZIP into the same repository paths. The scripts are optional but recommended to keep build regressions from returning. Do not replace your newer SQL migrations or downgrade other unpublished modules.

The **full source** ZIP starts from the latest unpublished Phase 030N-I buildfix package, includes both code repairs, and retains the earlier app changes. If your GitHub branch has newer commits, merge carefully instead of overwriting it wholesale.

Do **not** run any SQL migration for this TypeScript-only change. After committing, check the Vercel deployment commit SHA and compare with the pushed SHA to ensure Vercel is not building the old version.

## Verification

- `node scripts/verify-vercel-type-hotfix.cjs` — passed
- `node scripts/verify-directory-types.cjs` — passed
- `npm run check:routes` — 80 unique routes
- 47 `scripts/verify-*.cjs` checks — passed
- TypeScript syntax parsing — 250 TS/TSX files, zero parse diagnostics
- Full project semantic `tsc --noEmit` / Next.js build **not run**: npm registry unavailable (`EAI_AGAIN`) and dependencies are not installed in this runtime.

## Next step if another build error appears

Share the **next Vercel TypeScript diagnostic** in full. TypeScript stops after the first reported errors in some builds, so additional failures can become visible only after the present blockers are fixed. These source checks are not proof of a successful full build.
