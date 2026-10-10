# BusinessOS Phase 030L-B — Supabase Auth Email Recovery & Mobile Usability

**Status:** Source implementation ready for review and Vercel Preview. This patch cannot change any Supabase-hosted authentication quotas or SMTP credentials; those settings must be configured by an authorised project administrator.

## Reported incidents

1. Mobile signup reports `over_email_send_rate_limit` and a wait interval of approximately 36 seconds. This is a Supabase Auth email endpoint response (HTTP 429), not an error in the application's custom Resend API notification sender.
2. Login shows a generic account-status message; on-screen recovery is unclear. The address-bar `/login?error=` can also result from a failed/expired email callback.

## How email actually works

| Message | Sender / control point |
| --- | --- |
| Signup email confirmation / password recovery / invitation | Supabase Auth's configured SMTP provider (or a separately configured Auth Email Hook) |
| Platform notification templates, support messages, automation emails | BusinessOS application Resend API from `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in Vercel |

Supabase **built-in sender** is currently very limited (typically **2 Auth emails / project / hour**), unsuitable for unrestricted public signup. After configuring a **custom SMTP** Supabase initially applies a default of about **30 Auth emails/hour** unless changed in Authentication → Rate Limits; your actual sending provider separately imposes its own quotas. Resend Free currently advertises **100 messages/day** and **3,000/month**. These are not promises of unlimited free bulk sending.

## Owner-only setup (NOT performed by source patch)

1. In Resend, verify a sending domain that you own and set SPF/DKIM (and recommended DMARC). Use a sender such as `no-reply@your-verified-domain`.
2. Open Supabase **Authentication → Emails → SMTP Settings** and enable custom SMTP; host `smtp.resend.com`, port `465` (SSL; Resend also accepts 587 with TLS), username `resend`, password **Resend API key** (never commit it). Choose the verified sender address and business brand sender name.
3. Check **Authentication → Rate Limits**. Use the default initially; increase carefully for verified traffic, subject to Resend limits and sender reputation. Preserve anti-abuse limits.
4. Supabase **Authentication → URL Configuration**: site URL `https://busines-oss.vercel.app` for current deployment, and redirect allow-list `https://busines-oss.vercel.app/auth/callback` (plus preview domains only as needed). Vercel `NEXT_PUBLIC_SITE_URL` should match the deployed origin. Do not send customers to an unrelated domain.
5. In Supabase **Authentication → Emails → Templates**, verify Confirmation and Recovery links use the correct `{{ .ConfirmationURL }}`. Test with one account on Preview; do not repeatedly use real customer addresses.
6. Check Supabase **Authentication → Logs** for Auth codes and **Resend → Emails** for SMTP delivery state. Check junk folder, SPF, DKIM and sender verification. Do not turn off email confirmation to bypass rates.
7. Verify both signup confirmation and password reset (and the token callback), then login, workspace onboarding and owner/admin role routing with separate accounts.

## Implemented in app code

- **Signup**: limits and errors are translated into safe, actionable language without exposing raw Supabase internal messages; uses the exact retry-after seconds when available; includes confirmation password, show/hide and more mobile-friendly controls.
- **Sign-in**: specific warning for unconfirmed email, safe generic message for invalid credentials, built-in password recovery link, show/hide and a cooldown on 429 errors.
- **Callback**: failed/expired verification links explain how to request a new recovery email.
- **Reset request**: handles 429 gracefully and keeps generic responses to avoid identifying registered email addresses.
- **Platform admin email**: clarifies that application notification emails via Resend **are separate** from Supabase Auth verification emails. This avoids an incomplete fix.
- **Phase 030L POS**: improved scanner focus, explicit focus button for barcode devices, one-tap navigation to checkout/payment and confirmation before clearing a basket on location change. Preserves held carts, split tenders and VAT safeguards.
- **CSS**: touch-friendly fields, 16px inputs on iOS to prevent zoom, minimum 44px controls, accessible focus states, small-screen layouts and clear errors.
- **No new SQL**: This is a code-only update based on the existing Phase 030L complete source. Migrations 031–040 are shipped in full source unchanged.

## Critical deployment order

**Your last supplied SQL audit showed migrations 031–039 absent**, and GitHub `main` had migrations only through 030. Do not deploy the **full Phase 030L package** against that old schema. The safe immediate route is the separately packaged **AUTH-ONLY** patch, cherry-picked into the code that currently builds and runs. Append the supplied auth CSS (do not replace current `app/globals.css` with a newer branch's stylesheet).

The full source upgrade includes Phase 030L Premium POS, which additionally requires SQL **040** after SQL 039. Check each migration in staging first, and run `npm run typecheck`, `npm run build` and authenticated integration tests before promotion.

## Verification checklist

- [ ] With Supabase built-in email exhausted, signup shows friendly rate limit and countdown instead of raw provider text.
- [ ] With custom SMTP configured, confirmation mail is delivered from verified sender and user can confirm a fresh account.
- [ ] Unconfirmed account sees the verify-email prompt, not just generic invalid credentials.
- [ ] Wrong password shows safe credentials message, no account enumeration.
- [ ] Expired verification callback displays password recovery action.
- [ ] Forgot password response preserves email privacy; rate-limit attempts show guidance.
- [ ] On iPhone/Android 320–430px, all fields, toggles and buttons fit without horizontal overflow; 48px target sizes and input zoom behaviour.
- [ ] POS barcode Enter key adds one valid SKU; Focus Scanner button restores input focus; mobile Continue to payment scrolls correctly.
- [ ] Changing location with a populated basket asks confirmation.
- [ ] Legacy regression checks, Next.js typecheck, production build, RLS/SQL migrations and user acceptance tests pass on staging.

This release does **not** change Supabase email caps, verify SMTP, deliver email, access production credentials or modify GitHub/Vercel accounts automatically.
