# BusinessOS Performance Review & Focused Optimization

**Source reviewed:** the most recent prepared `BUSINESSOS_PHASE_030L_B_AUTH_MOBILE_FULL_SOURCE.zip`. **Live URL:** https://busines-oss.vercel.app/.

**Verification limitation:** The remote application could not be reached from the analysis environment for trustworthy Time to First Byte, Lighthouse, LCP, INP or CLS measurements. No network speed improvement is claimed until the Preview deployment is tested. No production deployment or database mutation has occurred.

## Confirmed implementation costs before this patch

1. The root layout exported `dynamic='force-dynamic'`, which forced dynamic rendering across otherwise public/static site pages.
2. The request proxy performed `supabase.auth.getUser()` even on the homepage, pricing, legal pages, signup and login.
3. The homepage, pricing and public CMS pages requested user-specific auth context before displaying otherwise public content. The public brand and CMS functions queried Supabase on each request, sometimes repeatedly from page and metadata.
4. The dashboard awaited large database lookups for orders, payments, products and expenses before painting most of its UI. This release leaves the underlying accounting math and row completeness checks intact.
5. The public navigation links prefetched many routes in the viewport, causing avoidable background network requests on some devices.
6. The global CSS bundle is large (>100 KB unminified). This patch adds below-the-fold rendering containment but **does not** claim to have split or removed unused CSS.

## Changes in this release (no new SQL migration)

- Root layout and public pages support 60-second revalidation. Public brand, published CMS pages and plan display metadata use tagged, short-lived caching. Admin CMS, branding and plan updates invalidate their respective tags via Next.js `updateTag`, preserving read-after-write for authorised editors.
- The request proxy now matches only protected workspaces and dashboard screens, rather than all anonymous marketing/authentication routes. Protected routes **still validate Supabase identity and tenant membership on the server**.
- Public website navigation is intentionally guest-neutral and contains no user-specific details. Logged-in users can click **Sign in** to reach `/login`, which redirects them to their workspace or administrator portal. This is a *presentation* change, not an authorisation change. The public site no longer exposes a session-derived admin menu until you enter the protected workspace.
- Authenticated `getWorkspace()` uses request-scoped React `cache()`: repeated layout and page calls during **one request** can share the verified membership lookup. This is **not** a persistent user cache and does not cross sessions or business tenants.
- Dashboard and workspace routes now provide loading states while private metrics load. This improves perceived response and interaction, but does not shorten the actual report query execution. The original completeness checks, summaries, and monetary calculations are preserved.
- Noncritical navigation prefetching is reduced. Below-the-fold public sections opt into CSS `content-visibility` on supported browsers; the hero remains rendered immediately.

## Rollout instructions — important

1. Back up the GitHub repository and deployment configuration.
2. **Do not copy the full archive over an older production branch blindly.** The archive includes Phase 030L features requiring SQL migrations through 040, whereas your last confirmed production SQL audit showed only through 030. Installation order and compatibility must be verified first.
3. Apply the changed files onto a review branch based on the **same Phase 030L-B source version**. If the live source differs, selectively merge the public performance edits (proxy, public cache, layout and auth/request logic); do not overwrite newer content or CSS with an older version.
4. Run `npm install` (or `npm ci` with a synchronized lock file), `npm run typecheck`, `npm run check:performance`, all regression checks, then `npm run build` in the deployment CI environment. A complete production build could not be run here because project dependencies are unavailable in the offline container.
5. Deploy to Vercel **Preview** first. Test homepage, `/pricing`, `/features`, `/signup`, `/login`, public CMS editing, admin login, and all protected workspace routes. Confirm session renewal and redirection are still working after navigating while logged in.
6. Use Chrome DevTools → Network and Lighthouse, including mobile throttling, plus field data from PageSpeed Insights or Web Vitals. Record and compare baseline and Preview performance on the same network/device.
7. In Vercel's functions/observability dashboard, review cold-start rates, slow routes, Supabase calls, and error rates; inspect Supabase query performance reports for indexes and RPC hotspots. DNS and provider delays may dominate when free-tier databases are sleeping.
8. Only promote after private tenant isolation, auth cookie refresh, CMS publication, account onboarding and critical POS checkout workflows pass in staging.

## Measurement checklist (fill before/after with real results)

| Journey | Metrics to compare | Notes |
| --- | --- | --- |
| Homepage first visit | TTFB, LCP, CLS | Anonymous user on a middle-range phone, throttled 4G |
| Pricing navigation | TTFB, first display | Compare multiple visits within 60 seconds |
| Sign up / sign in | TTFB, auth email delivery | SMTP rate limits are a separate concern |
| Logged-in dashboard | Time to heading/skeleton, time to real totals | Financial totals must not be cached across users |
| Checkout | Interactive readiness, complete checkout RPC latency | Use staging-only transactions |
| CMS update | Time until new content appears on homepage | Verify `updateTag()` invalidation |

Google's common *good* Core Web Vitals guidelines: LCP <= 2.5s, INP <= 200ms and CLS <= 0.1, evaluated at the 75th percentile of real page visits. These are targets, **not measurements of this site**.

## Future high-impact work

- Move dashboard/report aggregates into tenant-validated, indexed PostgreSQL RPC queries rather than fetching thousands of rows. Requires accounting review and reconciliation tests; not done here.
- Paginate and search POS catalogue and branch balances rather than loading hundreds/thousands on every visit; preserve exact availability and tax validation. Requires a separate functional update.
- Split giant global stylesheet into route-specific CSS, after visual snapshot testing so mobile and invoice printing are not broken.
- Add monitoring for slow Supabase query plans, auth refresh frequency, Vercel region mismatch, and server/function cold starts.

**No mandatory new API keys, paid services or SQL migrations** are required for this focused patch. Keeping public caching and private auth separate is a security-critical release requirement.
