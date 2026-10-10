# Phase 025: Vercel TypeScript hotfix

## Reported failure
Vercel commit `1d19154`: `app/(dashboard)/upgrade/page.tsx`, TS7006 at two occurrences of `.some(a => ...)` when the Supabase RPC result was not typed.

## Fix
Normalize the `published_plan_features` RPC result into a typed, validated `PublishedPlanFeature[]`. Both capability checks now use this list. This is a narrowly scoped change to the business Upgrade page; no database modifications or new environment variables are required.

## Deployment
For the one-file patch, copy `app/(dashboard)/upgrade/page.tsx` to the identical path in GitHub. Commit, wait for Vercel to rebuild, and check the *next* TypeScript diagnostic if one appears. Do not merge the complete ZIP over newer changes if the repository has moved ahead.

## Checks
- Local route audit: PASSED (54, no duplicates).
- Dynamic plan invariant checks: PASSED.
- Phase 025 local source and accounting invariants: PASSED (141 TS/TSX syntax checks).
- Full `next build` and actual `tsc --noEmit`: NOT VERIFIED. `npm install` failed with `EAI_AGAIN` contacting registry.npmjs.org in this environment.
- No SQL required. No GitHub push performed.

## Repository documentation layout
Only `README.md` should be retained at the root; other Markdown belongs in `MD/`.
