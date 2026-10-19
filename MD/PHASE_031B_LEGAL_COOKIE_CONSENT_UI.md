# BusinessOS Phase 031B — Visible Signup Agreements & Cookie Controls
**Status:** In review branch; not deployed to live production.
**Date:** 19 October 2026.
**Requires:** Migration 051, then migration 052.

## Features implemented
- Signup always shows an Agreements & Privacy panel linking to Terms, Privacy Notice, Cookie Notice and cookie settings.
- Once an actual, legally reviewed and matching Terms version has been registered, the checkbox is required, initially unticked and verified by the signup server action. Acceptance is stored by the migration 051 trigger.
- Before Terms are reviewed, the form describes their draft status and shows a disabled example checkbox. It does not make customers consent to unapproved language.
- First visit opens an essential-cookie notice on any BusinessOS page. Acknowledgement persists 180 days in a secure-on-HTTPS SameSite=Lax preference cookie named businessos_cookie_notice_v1.
- Cookie Settings modal is available from the public footer, cookie notice, signup and workspace privacy page.
- Strictly necessary is always active. Analytics and advertising categories are clearly marked not in use; no optional trackers are activated by this feature.

## Activation workflow for operator
- In System Owner, open /admin/privacy/legal. Confirm actual company identity, data processing and vendor facts first.
- Publish precisely reviewed Terms/Privacy/Cookies content in the Website CMS only after a qualified review.
- Record the authentic review reference, version number and truthful review confirmation in the Legal Approvals form.
- SQL 052 permits this action only to an active platform administrator and registers immutable review evidence. Application verifies a SHA-256 digest against the public Terms page before displaying an active agreement checkbox.
- Never create fake legal approval signatures or versions to turn on the checkbox.

## Safe installation
1. Back up the database and confirm all previous migrations through 050 actually ran.
2. Apply SQL 051 then 052 in a staging Supabase project before production.
3. Verify RLS, permissions and the user acceptance flow. Do not lose existing customer or financial data.
4. Test banner dismissal, reload, reopen settings, mobile layout, all account registration paths and cookies in a real browser.
5. Use npm run check:routes, npm run typecheck, npm run build and a Vercel preview for release checks.
6. Only merge after migration and legal approval requirements are met.

## Important limitations
- This release does not introduce analytics/marketing cookies; if tracking technology is introduced in future, genuinely optional granular controls, consent-before-load blocking and a revised cookie policy must be implemented.
- Other compliance work, including rights fulfilment, deletion schedules, NDPC classification, DPO/DPCO obligations, independent RLS/security audit and incident response, is still pending.
- Neither the interface nor legal-version database record automatically certifies legal compliance or replaces qualified legal advice.
