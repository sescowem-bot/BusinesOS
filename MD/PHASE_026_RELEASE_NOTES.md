# Phase 026 — Controlled Resend Email and Real Notification Events

## What was implemented

- System Owner template preview rendered using current branding, with no JavaScript execution in preview frames.
- Admin-only test email sending **to the signed-in System Owner's own verified account email**, not arbitrary recipients; five test attempts per hour per administrator, enforced in SQL.
- Test delivery logs (pending, accepted, delivered, bounced, complained, failed), persisted without storing email content or authentication tokens.
- Incoming Resend delivery webhook endpoint `/api/webhooks/resend`, verifying the *raw body* with Standard Webhooks HMAC signatures, constant-time comparison and 5-minute timestamp tolerance.
- Duplicate webhook receipt tracking; service role used server-side only, after signature verification.
- Separate **opt-in** Supabase Auth Send Email Edge Function with signed hook verification, protected redirects, responsive brand-aware markup and current CMS email templates. Support for signup, invitation, magic link, recovery, secure email change and security code is included. The hook has not been enabled; default Supabase SMTP/Auth sending remains intact.
- In-app notifications for real newly recorded orders and newly completed payments, delivered only to business owners who have not disabled optional in-app business notifications.
- Documentation remains in `MD/`; `README.md` is the only root markdown file.

## Important limitations

- **DO NOT enable the Supabase Auth Hook until a staging project has successfully tested every supported authentication flow**, including secure email change.
- The Auth Edge Function does not automatically share the Vercel environment: configure its secrets separately in Supabase.
- Email delivery logs on `/admin/email` currently cover **admin test emails**, not all automatic Auth Hook emails. Auth Hook emails use Resend and can be inspected in Resend provider logs.
- The new business event notifications are **in-app only**; emails for orders/payments/overdue balances/low stock are not yet enabled.
- Delivery webhook requires `SUPABASE_SERVICE_ROLE_KEY` privately on Vercel and `RESEND_WEBHOOK_SECRET`; never expose either in `NEXT_PUBLIC_*` variables.
- Normal outgoing business notifications and provider retries remain a future iteration. Do not turn the admin test action into a bulk email service.

## Deployment order

1. Confirm SQL migrations 001–024 are present and complete. Back up the database.
2. Apply **only** `supabase/migrations/025_email_delivery_tracking.sql` in staging. Do not rerun earlier SQL scripts.
3. Deploy updated application to **Vercel Preview**. Run `npm run check:routes`, `npm run typecheck`, `npm run check:phase26`, `npm run build`.
4. Leave `ENABLE_PLATFORM_EMAIL_DELIVERY=false` until sender is verified. Configure existing Resend key and verified `RESEND_FROM_EMAIL`. Then set the flag to `true` for the preview deployment only.
5. As the signed-in System Owner, open `/admin/email`, preview a template, send a test to your own account email and check its log.
6. Configure Resend Webhooks to POST `https://YOUR_PREVIEW_HOST/api/webhooks/resend` with `email.delivered`, `email.bounced`, `email.complained`; set the **per-webhook secret** in `RESEND_WEBHOOK_SECRET` and a private `SUPABASE_SERVICE_ROLE_KEY` on Vercel.
7. Verify delivered/bounced events update the matching test record and invalid or replayed webhook signatures cannot update logs.
8. Test a genuine order and completed payment with two separate business accounts to verify owner-only notifications and tenant isolation.
9. Deploy `supabase/functions/send-email/index.ts` to your staging Supabase project **without activating it**. Set Supabase secrets `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SEND_EMAIL_HOOK_SECRET`, `ENABLE_AUTH_RESEND_EMAIL=true`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` and `ALLOWED_AUTH_REDIRECT_ORIGINS`. The redirect origins list must contain your preview HTTPS domain and any explicitly approved domain.
10. Enable the **Send Email Hook** in staging only after deployment, then test signup, password recovery, invitation, magic link, secure email change (old and new email), reauthentication, invalid hook signature and provider failure. Only after passing these may production cutover be planned, keeping rollback to the existing Auth sending method ready.

## Required checks

- Run `node scripts/verify-phase26.cjs` and existing `npm run check:routes`.
- Verify read-only RLS for email deliveries; only an active Super Admin should read logs.
- Check Vercel Runtime Logs for errors without printing API keys or OTPs.
- Confirm the newsletter/marketing preferences are not bypassed; Phase 026 does not activate campaign sending.
- Monitor Resend quota; no paid extras were added by this release.

## Release state

Implemented in source, **not automatically deployed**, and not end-to-end validated against live Supabase/Resend. Do not call this production-ready before these checks pass.
