# BusinessOS Home Screen & UX Acceptance Checklist

**Environment:** Vercel Preview, real Supabase staging accounts. No production customer records.

## iPhone / iPad — Chrome

- [ ] Load `/install` in Chrome on iPhone. The iPhone / iPad device is selected or can be selected manually.
- [ ] Select **Chrome**. The guide shows Chrome-specific Share instructions, not mandatory Safari instructions.
- [ ] Tap Chrome Share, scroll to **Add to Home Screen**, then **Add** (Chrome browser and iOS support permitting).
- [ ] Open the new icon. Confirm the correct logo, application title and ability to sign in/navigate.
- [ ] If the option is absent, use the documented Safari fallback; the application never falsely claims to have installed itself.

## iPhone / iPad — Safari

- [ ] Select Safari instructions, tap Share → Add to Home Screen → Add.
- [ ] If available, enable **Open as Web App**. Verify standalone display after opening icon.
- [ ] Test with old and new iPad desktop user-agent mode; device selector must work in both.

## Android, Windows and macOS

- [ ] Android Chrome: menu → Install app or Add to Home Screen; icon opens the expected workspace.
- [ ] Windows Chrome/Edge: native install button if offered; test shortcut opens and doesn't lose session unexpectedly.
- [ ] Mobile device selector buttons are touch-friendly and keyboard accessible.

## Customer-facing text and errors

- [ ] Sign in, switch business, and visit dashboard with accounts on Free and higher plans.
- [ ] Visit customers, orders, checkout, POS, inventory, expenses, reports, team, growth, marketplace, quotes and install.
- [ ] Simulate denied role access, expired session, disconnected Internet and slow reporting on staging.
- [ ] No page asks users to apply SQL, repair Supabase, read error codes, or contact a developer.
- [ ] No raw Postgres table names, secrets, SQLSTATE codes, API keys, stack traces or framework errors appear in visible notices or notifications.
- [ ] When write status is uncertain, app does not advise blindly resubmitting duplicate payments or orders. Validate the saved record first.
- [ ] Legitimate business warnings (payment-not-processed, tax classification unapproved, inventory mismatch) remain accurate and understandable.

## Build and release gate

- [ ] Install npm dependencies with an appropriate lockfile and review updates.
- [ ] `npm run typecheck` succeeds.
- [ ] `npm run check:customer-ux`, `npm run check:ios-safe-errors` and all existing regression checks succeed.
- [ ] `npm run build` succeeds with correct Preview environment variables.
- [ ] Supabase staged migration check and role-based end-to-end tests succeed.
- [ ] Only then approve merging/deploying.
