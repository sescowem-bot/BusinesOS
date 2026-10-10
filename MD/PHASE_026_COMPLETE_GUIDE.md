# Phase 026 — Email, notifications, favicon and logo management

## Scope

This release combines the **professional System Owner dashboard design** and the Phase 026 email/notification work. It preserves existing customer workflows, pricing, CMS and migrations 001–024. No migrations are automatically executed.

### Completed in source

- Admin-only email template editing, responsive branded preview and controlled test sends to the administrator's **own** signed-in address (maximum five test attempts per account per hour, enforced in the database).
- Resend event webhook verification, delivery status tracking and signed-event deduplication performed atomically in SQL.
- In-app owner notifications on genuine orders and completed payments, respecting optional in-app business notification preferences.
- Supabase Auth Send Email Edge Function as a **separate, opt-in component**; activation is intentionally not automatic.
- Secure Platform Admin logo and favicon uploads into a dedicated **public** Supabase Storage bucket. Uploaded file bytes are checked for PNG/JPEG/WebP/ICO signatures, sizes are capped and SVG uploads are rejected. URLs use fresh UUID paths. Existing assets are not automatically deleted.
- Current logo used on public website, Super Admin sidebar, customer dashboard header, login/signup and branded email HTML; favicon used in browser tab metadata with a packaged fallback icon.
- All Markdown documentation lives in `/MD`, with only `README.md` in the GitHub root.

## SQL installation sequence

**Confirm previous SQL 001–024 first.** Back up the database and test against a Supabase staging branch/project. Apply each file **once**, in this order:

1. `supabase/migrations/025_email_delivery_tracking.sql`
2. `supabase/migrations/026_platform_brand_assets.sql`

Both are additive. Do not rerun the SQL 017–020 repair installer or reset the database. If an error indicates an existing table/policy, inspect migration history rather than deleting records or bypassing the guard.

## Vercel configuration

Server-only variables (never prefix with `NEXT_PUBLIC_`):

```env
RESEND_API_KEY=<existing-secret-key>
RESEND_FROM_EMAIL=no-reply@verified-domain.example
RESEND_WEBHOOK_SECRET=<per-webhook-signing-secret>
SUPABASE_SERVICE_ROLE_KEY=<secret-only-for-verified-webhook-handler>
ENABLE_PLATFORM_EMAIL_DELIVERY=false
```

Also configure the existing public Supabase URL/key and `NEXT_PUBLIC_SITE_URL`. Leave email delivery disabled until a verified Resend domain, Preview deployment and test sender are ready. Configure a Resend webhook pointing to `https://<preview-host>/api/webhooks/resend` for delivered/bounced/complained. The webhook uses the raw request body signature and the server-only Supabase service key.

## Super Admin setup and verification

1. Deploy the updated code to **Vercel Preview** (not production), and confirm `npm run typecheck` and `npm run build` succeed.
2. Sign in as an active `platform_admins` user. Open `/admin` and verify the sidebar and three management areas.
3. Open `/admin/website`. Under **Logo & favicon library**, upload a PNG/WebP/JPEG logo (up to 1.5 MB) and a PNG/WebP/ICO favicon (up to 512 KB).
4. Confirm image changes appear on `/`, `/login`, `/dashboard`, the admin sidebar and on the browser tab. Refresh tabs if the browser caches an old icon.
5. Open `/admin/email` and verify the template preview shows the current saved logo, platform name, primary colour and support email. Sending remains disabled until explicitly enabled in Preview.
6. Enable `ENABLE_PLATFORM_EMAIL_DELIVERY=true` only in Preview, redeploy and send one test to your own admin account. Confirm Resend acceptance and delivery webhook status in the history table.
7. Test with a non-admin user: `/admin/email` and `/admin/website` must deny access; brand uploads must be rejected server-side. Test rejected SVG/spoofed file content and oversized files.
8. Create a real order and complete a payment in a test business. Confirm only authorised owner(s) receive appropriate in-app notifications and no cross-tenant data leaks.

## Supabase Auth Send Email Hook — separate staged cutover

`supabase/functions/send-email/index.ts` is an example integration scaffold. Deploy to a staging Supabase project **without enabling the hook yet**. Its secrets are configured inside Supabase (they are **not** inherited from Vercel): `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SEND_EMAIL_HOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `ALLOWED_AUTH_REDIRECT_ORIGINS`, `ENABLE_AUTH_RESEND_EMAIL`. Check the Edge Function's compatibility with the current official Send Email Hook payload before activation.

Only enable after staging tests for **signup confirmation, invitation, magic link, password recovery, both secure email-change recipients, security verification, invalid signatures, errors and Resend retries**. Confirm expected OTP/link forms and Supabase Auth rate limits. Keep the existing authentication email provider working until all tests pass, with a rollback ready.

## Current limitations

- Live sending of business event emails (overdue balances, low stock, tax reminders, payment alerts) is **not enabled**; order/payment events currently create **in-app** notifications only.
- Delivery history covers admin test emails. Auth-hook email tracking remains with the provider.
- No user-configured email sender identity is allowed from the admin UI until domain verification/ownership controls are implemented. Sender is configured securely in Vercel/Supabase secrets.
- File content validation uses common magic headers and Supabase bucket MIME restrictions; it is not equivalent to malware analysis or image decoding. Avoid uploading untrusted, private or copyrighted customer files as branding.
- A clean Next.js build and live Supabase/Resend integration **could not be confirmed in this environment**. Do not use the term “production ready” until these tests pass.

## Checks performed in the prepared source

- `npm run check:routes`
- `npm run check:admin-ui`
- `npm run check:phase26`
- `npm run check:branding-assets`
- `npm run test:accounting`

Each checks source invariants; they do not replace Vercel typechecking, live Auth tests or a Postgres transaction audit.
