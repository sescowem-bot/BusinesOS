# Phase 030D — Controlled Automation Execution

## Scope

- Reuses customer request → Super Admin quotation → owner acceptance → configured status from SQL 029.
- New SQL 030 creates one schedule per configured request (daily or weekly; maximum 365 executions), admin activation/pausing, delivery run log, and owner-scoped read-only RLS.
- Reminders go **only to the business owner who requested the automation**, never to a customer or staff member. No event-driven overdue invoice/email scanning is deployed yet; it requires separate consent and workflow review.
- When an active schedule is due, a secret-protected server endpoint processes it via service-role-only RPC; email outbox claims use leases and per-attempt tokens. In-app alerts respect `notification_preferences.in_app_business`. Email is optional, to the owner who chose email delivery in their request, with a confirmed address and enabled `email_business` preference.
- Resend uses the **same run ID for retries** as the provider idempotency key. Retries at most three attempts; source runs have a unique schedule ID + execution timestamp. Server errors and provider acceptances are logged but an email accepted by Resend is not necessarily delivered to inbox.
- Cap: up to twenty in-app schedules per invocation and up to four email attempts per invocation, with a global maximum of forty automation email attempts per UTC day, to reserve space for other account emails. Resend and hosting have separate external quotas which may change.
- Clock: schedules are entered in **UTC**. When a daily/weekly schedule is delayed, missed periods are not backfilled in a burst. Consider timezone-aware schedules in a future iteration.
- No automatic billing or paid API is required. Admin must manually confirm commercial terms before configuring a request.

## First-time setup

1. Confirm 001–029 are present. Back up the Supabase database, then test `supabase/migrations/030_automation_execution.sql` in staging. Apply once only, then run `MD/VERIFY_SQL_030_READ_ONLY.sql`.
2. Deploy this source to a Vercel Preview build. Required existing public environment: `NEXT_PUBLIC_SUPABASE_URL`; on the **server only**, set `SUPABASE_SERVICE_ROLE_KEY` to the Supabase **service_role JWT**, not the publishable key. Never put it under `NEXT_PUBLIC_`.
3. Set a high-entropy `AUTOMATION_RUNNER_SECRET` of 32 or more characters. Set `ENABLE_AUTOMATION_RUNS=false` initially. Also set `ENABLE_AUTOMATION_EMAIL_DELIVERY=false` and keep your existing `ENABLE_PLATFORM_EMAIL_DELIVERY` and Resend configuration unchanged.
4. In `/admin/automations`, review an accepted request, mark it configured, create a schedule (paused), and check records in `/admin/automations` and owner `/automations/requests`.
5. Enable `ENABLE_AUTOMATION_RUNS=true` in staging. **Manual smoke test**: call `POST https://<preview-host>/api/internal/automation-dispatch` with header `Authorization: Bearer <AUTOMATION_RUNNER_SECRET>`. Do not paste this secret into public issue trackers, emails or browser URL query strings. This endpoint is not an interactive browser page.
6. Activate a daily in-app schedule for a test business owner. Manually dispatch and verify one due notification appears, the execution is marked `completed` and there is no duplicate notification, and repeated dispatch does not duplicate it.
7. For email testing, make sure the owner **explicitly requested email**, has verified their address, and has not disabled business email in notification preferences. Confirm the Resend sending domain, webhook delivery-status tracking, and email logs. Then set `ENABLE_AUTOMATION_EMAIL_DELIVERY=true` **and** `ENABLE_PLATFORM_EMAIL_DELIVERY=true` in staging. Validate no duplicate messages when retrying the same run.
8. Only after successful tests should you enable an hourly/daily scheduler and then consider production. Pausing `ENABLE_AUTOMATION_RUNS` stops ALL scheduled work; pausing `ENABLE_AUTOMATION_EMAIL_DELIVERY` stops new email dispatch but does not stop in-app alerts. Already queued email jobs stay pending until sending is enabled or manually reviewed.

## Free-first scheduling option

Use Supabase Dashboard → Cron to create a job that invokes the private HTTPS endpoint hourly (or a less frequent schedule suitable for your free allowances). For safe secret handling, store the endpoint URL and bearer token in **Supabase Vault** rather than hardcoding the token in plain SQL, the application or public URLs. `MD/OPTIONAL_CRON_WITH_VAULT.sql` is a **reference template**, not an automatically executed migration. Enable it only after verifying your project's Cron, pg_net and Vault availability and quotas. Vercel's free hosting may impose commercial-use restrictions; verify hosting terms before monetisation.

## Production restrictions and known gaps

- Do not assume SQL 030 has been applied or the worker is live without staging/live checks.
- HTTP call signing, tenant isolation and provider idempotency require live negative/positive tests. Tests based on source code alone are insufficient to certify them.
- New rules are DISABLED. This is intentional. No external customer reminders, AI content generation, SMS, WhatsApp, financial reporting emails, or task automation execution beyond owner-directed reminders is enabled by this release.
- If run completion database RPC fails after Resend acceptance, the worker will retry with the same provider idempotency key; verify actual Resend API behavior and webhook outcomes before production.
- Enable monitoring and execution history review, especially `error` and `skipped` rows. Review stale credentials and rotate secrets when necessary.

## Project structure

Only `README.md` remains in the root. All other Markdown documentation belongs in `MD/`. No existing migrations are replaced or rerun.

**Important:** This phase enables scheduling ONLY for `task_reminders`. Other request categories (payment reminders, inventory, reports and custom) still require separate reviewed implementations. Email is sent to the requesting owner, not to customers. The server uses `POST /api/internal/automation-dispatch`, not a public GET job.
