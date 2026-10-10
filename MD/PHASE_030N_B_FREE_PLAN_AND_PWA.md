# BusinessOS Phase 030N-B — Automatic Free Plan + Install on Home Screen

## Customer issue corrected

The onboarding RPC creates a business and grants the creator the `owner` role, but previously did **not** create a row in `business_plan_assignments`. As a result, new business owners saw **"No approved plan assigned yet"**. This is a missing default, not a request they should have to wait for platform administrator approval.

### Migration 043 (new database migration)

- Adds a distinct **Free** plan (`id='free'`, ₦0, Forever), **without modifying** the existing Starter, Growth or other published plan definitions.
- Adds a database AFTER INSERT trigger on `public.businesses` to assign `free` in the same transaction as business creation. Since `create_my_business_workspace` already creates an Owner business membership, the creator receives **Owner role + Free plan** automatically.
- Backfills a Free plan **only** for businesses with no existing assignment. Existing approved paid plans and any upgrade history remain untouched. Upgrade approvals can replace Free normally.
- Uses `ON CONFLICT DO NOTHING` and database-managed writes; browser clients do not get direct plan-assignment write access.
- Free includes the existing essential tools (business dashboard, customers, orders, manually recorded payments, products, expenses, settings). Plan entitlements for paid modules remain separately controlled by platform plan configuration. This patch **does not** grant every premium feature for free.
- The `/upgrade` page displays **Free · Active at no cost** and makes clear that Free needs no administrator approval. It still allows the owner to request higher plans.

**Installation order**: migration `043_default_free_plan_pwa_onboarding.sql` is after 042. Apply **once in staging**; review `MD/VERIFY_SQL_043_READ_ONLY.sql`; create a brand-new test owner/business; then deploy matching source to a Vercel Preview.

## Install BusinessOS as a web app

- New `/install` landing page with a one-click browser installation option where `beforeinstallprompt` is provided.
- iPhone Safari users: **Share → Add to Home Screen → Add**.
- Android Chrome: menu → **Install app** or **Add to Home Screen**.
- If the site opens inside WhatsApp Business or another in-app browser, first open the page in Safari/Chrome.
- The workspace sidebar and public footer link directly to the guide.
- `app/manifest.ts` provides the current public platform brand name, scope, start URL, standalone display, theme and icon paths.
- Static PNG app icons are provided in 180, 192 and 512 px sizes, including a 512 px maskable icon, for broad device support.
- **App installation does not require a paid store account and does not make the product a native Android/iOS binary.** It does not enable offline transactions. No service worker caches private customer or financial pages.
- If the platform admin later changes the company brand, the manifest app name can update after browser caches refresh. The static "B" icon is deliberately kept independent of uploaded logos for predictable rendering; if desired, regenerate and redeploy app icons after a branding change.

## Staging acceptance tests

1. Run SQL 043 after 042 and verify one row in `public_site_plans` with ID `free` and zero-price editorial copy.
2. Create new verified user, complete onboarding. Confirm `business_members.role='owner'`, `business_plan_assignments.plan_id='free'`, and no pending upgrade request.
3. Open `/upgrade`: Free appears active, not "No approved plan assigned yet".
4. Verify customers, orders, payments, products and expenses remain accessible to the new owner.
5. Verify premium permissions remain restricted and cannot be bypassed by changing URL or a client request.
6. Verify a business already on Growth/Pro/Starter stays on its prior plan; backfill does not downgrade it.
7. Verify an older business missing an assignment receives Free while retaining its existing records.
8. Approve an upgrade from Free as platform administrator, then check that the approved plan replaces Free and persists on reload.
9. New business created through another authorised workflow also gets Free from database trigger.
10. On iPhone Safari, add to home screen. Icon and name should appear; opening it should launch standalone login/workspace as appropriate.
11. On Android Chrome, test both native install prompt (if offered) and browser menu installation.
12. From WhatsApp Business in-app browser, test manual Safari/Chrome instructions and external-browser opening.
13. Confirm all private business financial pages require valid authentication when launched from the installed app.
14. Confirm mobile navigation to `/install` does not overlap other menus or controls.
15. Validate `/manifest.webmanifest` returns a valid JSON manifest and all 180/192/512 PNG assets return HTTP 200 on Vercel Preview.
16. Run `npm run check:free-pwa`, `npm run check:routes`, all existing regression checks, `npm run typecheck` and a clean `npm run build` in CI.

## Limitations and deployment safety

**Do not install 043 if previous migrations through 042 have not been verified.** The Supabase database was previously reported out of sync with development source; check migration state before applying any new SQL. This release has not run against a live PostgreSQL/Supabase environment or completed a clean production build. Prepare a database backup and verify in staging, then promote together with its code changes.

No existing business is downgraded, no bank payment is processed, and no card details are stored by this upgrade.
