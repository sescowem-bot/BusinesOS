# Phase 030N-F — iOS Home Screen and Customer-Safe Error States

## Scope
- iPhone/iPad instructions are accessible immediately, with manual device choice that does not depend on user-agent detection. Support desktop-mode iPad, iOS browsers and home-screen standalone detection. Safari Share → Add to Home Screen is the recommended route; an iOS App Store listing is not included.
- On app-facing pages, installation and failed database calls show understandable action-oriented messages instead of SQL migration numbers, PostgREST codes, Supabase error contents, or backend setup instructions.
- Server actions use a centralized friendlyServiceError function to translate well-known error categories and default to a generic safe message. Never leak raw database details in action state.
- Database, financial and permission behaviour remain unchanged. Errors do not turn into zero balances or false confirmations. No SQL migration needed.

## Acceptance tests
1. Open /install in iPhone Safari, Chrome for iOS, iPad with Request Desktop Site, Android Chrome, Windows. The iPhone tab must always be available.
2. On iPhone Safari tap Share > Add to Home Screen, confirm correct BusinessOS icon, relaunch; verify login and workspace navigation.
3. Simulate unavailable database/read permissions in staging across workspace, POS, invoices, accounting and admin. Expect clear retry/support guidance, no raw backend message.
4. Simulate validation errors. Users should still see specific corrective instructions.
5. Verify authorization restrictions, accounting workflow and RLS remain enforced.
6. Confirm browser console/network may still contain technical error detail, but app-visible copy must not.

Note: Source-level checks only. A physical iOS install and a live production build need validation in preview.
