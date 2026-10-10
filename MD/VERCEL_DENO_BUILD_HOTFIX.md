# Vercel TypeScript failure: Supabase Edge Function

**Affected deployed commit:** `0fc6cb2` (BusinessOS, `main`).

**Error:** Next.js TypeScript checker includes `supabase/functions/send-email/index.ts`; that file is written for the Deno runtime and imports `npm:standardwebhooks@^1`, exposes `Deno`, and uses Deno HTTP server entrypoints.

**Change:** Root `tsconfig.json` excludes `supabase/functions/**` from the Next.js TypeScript program. `strict` remains enabled, and the `supabase/functions` folder and its contents remain untouched. The Edge Function must be validated/deployed separately using the Supabase CLI and Deno toolchain.

**Apply:**

1. Replace **only** root `tsconfig.json` in the GitHub repository with the version in this patch.
2. Commit and redeploy to Vercel Preview.
3. Confirm that `npm run typecheck` and `npm run build` succeed. If another error appears, send the first error from the new log.
4. Separately validate `supabase/functions/send-email/index.ts` in the Deno environment before activating Supabase Send Email Hooks. It is **opt-in**, not enabled by this change.

**No new SQL migration.** No change to Resend secrets, business data, or authentication configuration.

## Verification limitations

The patched TypeScript configuration was parsed with the TypeScript compiler configuration API. That confirmed that the Next.js program includes application TS/TSX files but excludes `supabase/functions/send-email/index.ts`. This is a configuration-scoping repair; a complete Next.js build still needs a dependency-installed runner/Vercel Preview.
