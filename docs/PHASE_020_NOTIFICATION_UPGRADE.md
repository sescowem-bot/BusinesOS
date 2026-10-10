# Phase 020: Notifications and email foundation

## Source audited

Phase 019 archive. Major observations: `/upgrade` assumed pricing `features` always an array; `/admin` queried a non-existent `id` field from `public_site_pages` (the primary key is `slug`). Both were corrected.

## Included

- `/notifications` recipient-only inbox, read/unread, preferences.
- `/admin/email` protected template editor and dynamic branding display.
- Additive SQL migration 020 including notifications, preferences, editable templates, upgrade-request/decision in-app event triggers.
- Safe opt-in server-only Resend sender module, off by default.
- Defensive `/upgrade` page query rendering and updated admin CMS count query.

## Deploy

1. Back up database; verify migration 019 is installed.
2. Run migration 020 **once**, preferably in staging first.
3. Deploy code to matching Vercel project and confirm env values and URLs.
4. Verify signup/login, `/upgrade`, `/admin`, `/admin/email`, `/notifications`, user preferences.
5. Submit a legitimate upgrade request; confirm Super Admin notification; approve; confirm owner notification.
6. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` **server-side**, but leave `ENABLE_PLATFORM_EMAIL_DELIVERY=false` until tested.

## Auth email migration remains separate

Supabase Auth emails currently send through its configured provider. The renderer/Resend adapter here is **not** yet a deployed Supabase Send Email Hook. Do NOT disable SMTP or turn on an Auth Hook until request signature checks, hook secrets, fallback and end-to-end confirmation/reset flows are implemented and verified. For dynamic Auth email templates, use a secure Hook running server-side (e.g. Supabase Edge Function) that validates Supabase hook requests, fetches only approved templates/branding, creates provider messages and returns the required hook response. Do not store secret keys in frontend code.

## Upgrade route troubleshooting

On Vercel, navigate **Project > Logs**, filter path `/upgrade` and timestamp/error digest from the screenshot. The screenshot alone cannot prove the underlying server failure. Confirm migrations 016, 017 and 019 and latest deployment environment point at same Supabase project. The page has now been made resilient to missing/malformed pricing `features`, query errors, and empty request histories. If it still errors, capture the actual Vercel server exception.

## Scope boundaries

No automatic SMS/email delivery, Auth Hook, background email queue, provider webhooks, or guaranteed notification coverage for all business events yet. They require dedicated authenticated webhook handlers, tenant-scoped outbox jobs, permission checks, budgets, retries and delivery logs. No test message was sent. No live Supabase migration or production build was executed in this local run unless explicitly shown in the report.
