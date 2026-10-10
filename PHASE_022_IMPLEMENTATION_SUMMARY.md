# Phase 022 Package Summary

**Full source:** The project root has `app/`, `components/`, `lib/`, `supabase/`, `scripts/`, `docs/` and `package.json`.

**Database:** Apply new migration `supabase/migrations/021_admin_business_review.sql` ONLY after 001–020 have succeeded. Migration 021 adds admin-internal notes and history. It does not disable businesses or modify pricing entitlements.

**Pages:** `/admin/businesses` and `/admin/businesses/<business-id>` for admins; `/admin/content` offers no-code page section editing.

**Risk controls:** No automatic deployment. No live database changes made. No Supabase service role key in client code. Direct note tables remain inaccessible to `anon` and `authenticated`; access goes via gated administrator RPCs. Test RLS in a connected staging database before deployment.

**Verification:** Local parsing/logic and route checks passed. Full `tsc`/Next.js build and live integration remain pending until package installation succeeds.

Read `docs/PHASE_022_RELEASE_NOTES.md` for detailed deployment steps and acceptance tests.
