# BusinessOS Phase 030N-F: iOS install + safe customer feedback

## What is fixed
- `/install` now includes a manual iPhone/iPad, Android and Computer selector. iPhone guidance is visible before JavaScript hydrates. iPad desktop user-agent compatibility and installed-app mode are supported.
- iPhone users: open BusinessOS in **Safari**, tap **Share** > **Add to Home Screen** > **Add**. When the option is missing, inspect the Share menu and Edit Actions. The site can be launched from the Home Screen; this is not an App Store listing.
- Readable, operation-specific actions replace raw database, SQL, migration, storage and email provider errors in ordinary customer pages and server action responses.
- Role restrictions and validation errors remain informative; failed financial verification still does not display zero or fabricated totals.
- App-level and global error boundaries have retry actions and a branded, compact interface.
- Developer diagnostics and migration status should remain in restricted Super Admin diagnostics, never in ordinary customer workflows.

## Changed files and integration
- This is a **source patch**, based on `BUSINESSOS_DASHBOARD_REPORTING_FIX_FULL_SOURCE.zip` following phases 030N-B/030N-D and dashboard 045 source fix. Keep any newer project changes and reconcile conflicts before merging.
- **No new SQL migration**. Does not replace or install SQL 044/045; your database migrations remain a separate prerequisite to the features depending on them.
- No new environment variables. No JavaScript dependency or service worker added.
- CI: run `npm run check:ios-safe-errors` plus the existing regression suite, followed by `npm run typecheck` and `npm run build` when dependencies are installed.

## Deployment acceptance checks
1. Test `https://<your-preview-domain>/install` in Safari on iPhone. It must show iPhone steps, even before/without device detection. Open Safari Share > Add to Home Screen. Check icon and standalone launch.
2. Test iOS Chrome, iPad with Request Desktop Site, Android Chrome, Windows Edge, and in-app browsers. Use the device tabs to override detection.
3. Simulate failing RPC and denied-access responses in Preview, then inspect customers/orders/expenses/checkout/accounting/notifications/support and the dashboard. No SQL migration number, raw SQL, table name, stack trace, provider message, or database function name should appear.
4. Test an invalid payment amount, duplicate product, expired session and a permission denial. Users should get clear, relevant next steps without false confirmation of changes.
5. Test admin company features, branding upload and email test failure; operation should remain auditable server-side while UI contains no untrusted provider text.
6. Confirm email configuration, Supabase RLS, subscription roles and accounting logic behave the same, and existing branded loader is unchanged.
7. Measure real iPhone PWA and production build separately; neither is proven by source-only checks.

## Limitations
- iOS users install a website shortcut/PWA via Safari; there is no native iOS application or Apple App Store listing.
- Online access is required for saving and viewing sensitive business transactions.
- No complete `npm ci` + Next production build was run in this workspace, because the source archive lacks `package-lock.json` and installed project dependencies. Source parsing, route checking, regression scripts and new feedback checks run independently.
- This is an application-source change, not a live deployment. No GitHub push, Vercel deployment or Supabase database write is performed.
