# BusinessOS Phase 021 — Stability, Session & Permission Hardening

**Source baseline:** Phase 020 notification upgrade and migrations 001–020. The user confirmed the SQL repair for 017–020 completed successfully; this has **not** been independently queried or deployed by the author.

## Included changes

- Added **Next.js 16 Supabase session refresh proxy** (`proxy.ts`), addressing session-cookie refresh limitations from Server Components. Protected operations still check the authenticated user and tenant.
- Centralized deterministic workspace membership resolution, with clearer distinction between platform admin and business member routes.
- Improved onboarding failure messages: recognizes missing RPC, missing profile, permissions and conflict errors rather than always reporting migration 004 missing. Also detects an existing membership before attempting creation.
- Normalized the email-confirmation URL to `/auth/callback?next=/onboarding` when a safe HTTPS site origin is provided; retained current Auth SMTP setup.
- Fixed conflicting site URL variables (`NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL`) and browser Supabase key fallback.
- Rebuilt **business upgrade request and admin review forms** with React `useActionState`; expected validation/database errors now appear in the page rather than throwing a generic Next server exception. Ensured no mutation when current plan/history cannot be verified.
- **Selected server operations now enforce plan and role entitlements**, not only route page rendering: accounting actions, financial report exports, campaigns, communications, team, growth and stock changes. Product creation with inventory tracking now checks inventory entitlement; normal product creation remains core.
- Added admin-only `/admin/health` database read-only diagnostics for migrations 016–020 and `/admin/notifications` so platform owners without business membership can view their notifications.
- Added notification bell/unread count in the business header, and unread link from Super Admin overview. Counts refresh with route navigation; live push/realtime remains a future task.
- Added scoped `error.tsx` boundaries for business and administrator screens to offer retry and show a support reference while keeping stack traces out of the interface.
- Updated test assertion in `tests/calculations.test.ts` to reflect the actual documented calculation: delivery fee is excluded from merchandise gross profit; total payable includes delivery.

## Required database changes

**None for Phase 021.** Do NOT rerun migrations 001–020. A read-only verification query is at `docs/PHASE_021_DATABASE_PREFLIGHT_READ_ONLY.sql`.

## Required application configuration

`NEXT_PUBLIC_SUPABASE_URL`, one of `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL` set to your verified HTTPS website origin. Add the callback URL to the Supabase Auth redirect allow list. Keep existing Resend/auth delivery in operation; no new Auth Hook is installed.

## Verification completed here

- 46 unique app page routes, no route collisions.
- TS/TSX **syntax/transpilation** checks on all 120 TS files passed (not a complete typecheck).
- Three pure logic test groups passed: orders/calculations, ledger/reporting/CSV protections and tax review safeguards.
- ZIP archive integrity is to be verified after packaging.

## NOT VERIFIED

- No full `npm run typecheck` or `npm run build`: package dependencies are not installed; npm registry access from this environment failed (`EAI_AGAIN`).
- No authenticated live Supabase integration test, external email test, GitHub push or Vercel deployment was performed.
- **API-level plan enforcement remains incomplete**: some previously created PostgreSQL RPCs and direct PostgREST table writes may need additional SQL controls after a detailed RLS audit. The new server-action guards do not replace database-level enforcement.
- No automatic accounting journal postings, real Resend Auth Hook, outbound campaign delivery, offline/mobile app or full CRM workflows were added.

See `docs/PHASE_021_DEPLOY_AND_ACCEPTANCE_TESTS.md` for exact next steps.
