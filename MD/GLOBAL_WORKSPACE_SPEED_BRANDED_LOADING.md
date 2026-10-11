# BusinessOS — Global Workspace Speed and Premium Branded Loader

## Release purpose

This **no-SQL** update extends the preceding Expenses hotfix to **all workspace navigation**, including Dashboard and System Owner tools. It replaces the misleading generic *Opening your workspace — checking access…* screen with a compact logo and a rotating ring. It improves perceived loading but **does not pretend to fix every backend bottleneck**.

The loader does **not** query Supabase. It uses the existing platform logo/name supplied by the shell once loaded; before first shell render, it uses the local `/app-icon-192.png`. The current business name appears when available. Avoid additional business-profile database calls merely to render a loader. Company-specific invoice logos remain separate from the platform's configured branding.

## Actual performance work

1. All ordinary business workspace sidebar, mobile tab and high-traffic header links now explicitly opt out of eager route prefetching. The prior sidebar exposed dozens of protected pages whose RSC prefetches could compete for Supabase auth/database resources. Routes still navigate normally when clicked.
2. The System Owner sidebar now avoids auto-prefetching large admin pages.
3. The previous request-scoped `getWorkspace=cache(...)` continues to reuse authenticated membership checks within one server request. **No cross-user caching of private financial data was added**.
4. Expenses keeps its independently streamed form and its 25-record paginated register.
5. The shared loading component is present for the entire application, business workspace, Dashboard, Expenses and admin area. The animated ring uses CSS; there are no new image libraries, timers running after unmount, or external animation APIs.
6. After 10 seconds it shows **Taking longer than expected** and useful Retry / Support controls instead of displaying progress bars that imply completion percentages.
7. Users who request reduced motion get a **static** loading ring.
8. Optional server-side timing for workspace shell operations can be enabled using `BUSINESSOS_PERF_DIAGNOSTICS=true` in **Vercel Preview only**. Logs report durations but do not expose customer names, emails, access tokens or payloads. Turn it back off once the timing bottleneck is located.

## Installation

1. **Deploy this update on a review branch**, not directly into production. The full source is based on the previous Expenses speed hotfix; a changed-files patch is also included. Compare your GitHub main branch against that base before merging; do not replace newer code blindly.
2. **No SQL migration and no new required secrets.** Existing migration requirements from prior development phases remain mandatory for the full source.
3. Run `npm ci` after generating and committing an accurate project `package-lock.json` (the inherited source did not include one). Then run `npm run typecheck`, `npm run build` and all GitHub Action checks.
4. Deploy a **Vercel Preview** build to the same deployment region as the live project. Keep production data and credentials isolated when possible.
5. Compare pre/post performance on real mobile devices and desktop. Measure homepage, Dashboard, Orders, Expenses, Inventory, POS and Admin; capture repeated navigation and fresh-load results. Suggested metrics: server initial response time, Largest Contentful Paint, Interaction to Next Paint, and 75th percentile route-transition duration.
6. Test failed-connection and expired-session behavior: errors must remain visible and users must be able to retry. A spinner is not a substitute for backend health monitoring.

## Visual behaviour

- Spinner: navy and green thin CSS ring rotating around an **upright** logo. The logo stays readable (it does not spin sideways).
- Platform logo: uses the already-loaded cached public `platform_branding.logo_url` when available; **fallback** local BusinessOS app icon.
- Workspace title: uses the available active business name while the shell is present, else BusinessOS name.
- If an operation stalls for 10 seconds, an accessible *Retry page* action and support link appear.
- Phone screens use a compact centered loader. Motion disabled for `prefers-reduced-motion`.

## Required staging checks

- [ ] No global *Opening your workspace* placeholder remains on any loading boundary.
- [ ] Logo and spinner appear on Dashboard, Orders, Expenses, POS, Inventory, Accounting, Reports and Admin pending route states.
- [ ] Custom platform logo is used after the authenticated shell loads; local icon loads before first shell render.
- [ ] The logo remains upright and animation is subtle on Android and iPhone.
- [ ] Reduced-motion accessibility setting stops the rotation.
- [ ] Slow connection displays help/retry after 10 seconds.
- [ ] Clicking Retry reloads the current page; support opens a valid route for signed-in users.
- [ ] Business sidebar and admin sidebar don't generate dozens of idle prefetch requests on opening.
- [ ] Business owner, sales staff, managers, platform admin and logged-out users see only authorised data and navigation.
- [ ] Financial order/payment/stock/expense logic remains unchanged.
- [ ] Reconcile dashboard and expense totals with the prior release after staging deployment.
- [ ] Compare navigation latency with DevTools **Network** and Vercel function timings; do not claim speed gains solely from a spinning animation.

## Limitations and next performance phase

This release removes a substantial source of possible background traffic and improves loading feedback. It **cannot guarantee pages load quickly** if Supabase is in a distant region, RLS queries lack indexes, auth refresh is slow, or your Vercel functions are cold. Authenticated layouts still verify each user's session, business membership, and platform-admin status; these checks must not be removed just to increase speed. Future improvements should be driven by actual latency measurements and may involve optimized server-side SQL summaries, connection regions, and targeted indexing—never guessing or caching financial records across tenants.
