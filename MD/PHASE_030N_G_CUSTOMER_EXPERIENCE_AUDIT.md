# BusinessOS — Phase 030N-G Customer Experience Audit & Chrome iOS Installation

## Source of truth and what was compared

This release is based on the **unpublished** complete source package `BUSINESSOS_IOS_PWA_CUSTOMER_SAFE_UX_FULL_SOURCE.zip`, not the older GitHub default branch. The connected GitHub repository is `sescowem-bot/BusinesOS`, branch `main`. The GitHub files `components/install-app-guide.tsx`, `app/(dashboard)/dashboard/page.tsx` and `package.json` were inspected in October 2026. GitHub's install component lacked Chrome-specific iOS steps, GitHub's dashboard still included old SQL-042 wording, and `lib/user-feedback.ts` was absent from GitHub. The local source already included previous unpushed safety and device picker fixes.

Do **not** cherry-pick only this patch onto the older GitHub `main`: it depends on the immediately preceding local source. First merge/replace with this complete source in an isolated branch and review against any newer GitHub commits. This package does not push, merge or deploy.

## Corrections made in this release

1. iPhone/iPad instructions now provide **Chrome** and **Safari** selections, with automatic initial browser detection and a manual override for inaccurate user agent strings. The guide never requires a Chrome user to switch to Safari when Chrome's Share sheet offers Add to Home Screen. A Safari fallback is documented when the menu option is unavailable on a specific device. WhatsApp/in-app browser behavior is explained, and Android/desktop modes remain available.
2. Installation content now explains what Home Screen installation actually does. iOS uses Share → Add to Home Screen. It does not receive the Chrome desktop `beforeinstallprompt` event. The web app requires Internet access for normal business transactions. No service worker is added to cache private records offline.
3. Customer-facing copy reviewed and revised on dashboard, marketplace, quote register, team & branch management, inventory/location counts, retail reports, POS, checkout, tax-reviewed orders, payments, order creation, growth centre, automation requests, and cashier reports. Financial caveats and unsupported features remain visible in understandable words.
4. Customer error boundaries (`app/error.tsx`, `app/global-error.tsx`, dashboard error boundary) no longer render an internal digest/reference or send entire Error objects to `console.error` from client code. Production server-side error tracking must be configured separately. Admin error message remains safe; System Owner `/admin/health` retains diagnostic details intentionally.
5. Quotes now display an inline customer-friendly error with Retry rather than throwing a technical error about database permissions.
6. 17 verification scripts previously used one developer machine’s absolute TypeScript installation path. They now load `scripts/load-typescript.cjs`, which prefers the project’s installed `typescript` devDependency. This makes the check suite portable to GitHub Actions while allowing the current local Node installation to run checks.
7. New source-level guard `scripts/verify-customer-facing-ux.cjs` checks customer-facing JSX copy and app-install implementation. Run `npm run check:customer-ux`; the GitHub Actions verify workflow also runs this test after dependencies are installed.

## Verified results

- 43 `scripts/verify-*.cjs` regression checks passed locally.
- 75 unique Next.js routes passed the route audit.
- New customer UX guard passed 139 checks across 106 customer TSX files (static source parsing and JSX only).
- Existing iOS/safe-errors guard passed 405 checks across 200 app/component TS/TSX files.
- Full source and changed-file ZIPs were checked for CRC integrity during release packaging.
- This **is not** proof of successful production build, dynamic rendering, full database error coverage, all device behavior, security audit, or live user journey.
- `npm ping` failed in the local environment, and `node_modules` and `package-lock.json` were absent. Therefore an actual `npm ci`, `tsc --noEmit` and `next build` could not be confirmed. The GitHub Actions workflow includes these steps for the review branch.

## Features or limitations NOT changed by this review

- App Store or Play Store native publication. This remains an installable web app; iOS installation requires a Share-menu user gesture. There is no custom automatic iOS install button.
- Offline business transactions, sync, or push notification permission setup. None was newly implemented here.
- The **database migrations 043, 044 and 045**, pricing and company role logic. The source includes prior scripts but this update doesn't apply migrations or alter database schemas. Verify and stage those separately.
- No live Supabase authentication, RLS, plan entitlement or payment posting verification was performed. Customer-safe messages do not establish that a failed transaction did or didn't persist; users should verify transaction status before retrying.
- Quote creation/conversion UI is still unavailable in the reviewed source, although quote listing exists.
- Staff invitation emails are not automatically sent from the Team page yet; recipients need verified accounts. Branch assignment/consolidated branch reports are not fully integrated there.
- Marketplace directory listing exists, but public contact and storefront links are unavailable in the reviewed source.
- Growth Centre document file uploads and goal progress tracking are not enabled yet; the current interfaces store register details and goals.
- Ordinary sales-order stock deductions are not yet automatically integrated everywhere, according to the reviewed inventory screen.
- Some more specialized reports, accounting views and admin diagnostics legitimately include financial terms, technical checks and warnings. Admin-only diagnostics should remain for the System Owner.
- This is a source-language audit of customer-facing screens and shared errors; dynamic values coming from database content, templates, remote email providers and untested runtime integrations still need live QA to guarantee appropriate presentation.

## Next release recommendations (not implemented)

1. Run a successful clean dependency install, typecheck, production build and CI against the unified source and newest branch.
2. Verify migration 044 and 045 status before touching any database. Recheck dashboard financial metrics with a real authenticated role and with financial reports both enabled and disabled.
3. Run the attached iOS Chrome/Safari/Android/desktop UAT on real devices (not a desktop user-agent emulator).
4. Run seeded-tenant end-to-end permission checks and inspect each form submission, error/retry and loading state with non-admin users. Do not claim universal error secrecy until server-generated dynamic messages and third-party responses are tested.
5. Address the documented unfinished user workflows as separate, reviewed feature releases.

## Developer handover

The previously unpublished source changes are preserved. No SQL is needed for this UX copy and iOS browser guide release. Avoid overwriting the source with an older GitHub ZIP. Review the changed-only archive for an exact file list.
